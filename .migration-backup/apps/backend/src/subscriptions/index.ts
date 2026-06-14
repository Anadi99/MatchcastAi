import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import express from 'express';
import cron from 'node-cron';
import Razorpay from 'razorpay';

import { sendMessage } from '../bot';
import { generateSummary } from '../commentary/engine';
import { insertPayment } from '../db/payments';
import { getSubscribersForMatch } from '../db/subscriptions';
import { downgradeExpiredPremiumUsers, getUserByTelegramId, upgradeUserToPremium } from '../db/users';
import { supabase } from '../db/client';
import type { Match } from '../types/db';

// ── Razorpay client ────────────────────────────────────────────────────────────

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
});

// ── Task 12.1: createOrder ────────────────────────────────────────────────────

/**
 * Create a Razorpay order for the ₹99/month premium subscription.
 * Returns the order ID, amount in paise, and a hosted checkout URL.
 *
 * Requirements: 6.3, 12.1
 */
export async function createOrder(
  telegramId: number
): Promise<{ orderId: string; amount: number; checkoutUrl: string }> {
  const receipt = `sub_${telegramId}_${Date.now()}`;

  const order = await razorpay.orders.create({
    amount: 9900, // ₹99 in paise
    currency: 'INR',
    receipt,
    notes: {
      telegram_id: telegramId.toString(),
    },
  });

  return {
    orderId: order.id,
    amount: 9900,
    // In production this would be a real Razorpay hosted payment link.
    checkoutUrl: `https://rzp.io/i/MatchCastAI`,
  };
}

// ── Task 12.2: setupSubscriptionRoutes ───────────────────────────────────────

/**
 * Register the Razorpay webhook route on the Express app.
 *
 * The route uses express.raw() so we receive the raw body bytes needed for
 * HMAC-SHA256 signature verification.
 *
 * Requirements: 6.4, 12.2, 12.3, 12.4, 12.5
 */
export function setupSubscriptionRoutes(app: Express): void {
  app.post(
    '/webhook/razorpay',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      // ── Signature verification ───────────────────────────────────────────
      const receivedSig = req.headers['x-razorpay-signature'] as string | undefined;
      const rawBody: Buffer = req.body as Buffer;

      if (!receivedSig || !rawBody) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'Razorpay webhook: missing signature or body',
          })
        );
        res.status(400).json({ error: 'Missing signature or body' });
        return;
      }

      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET ?? '')
        .update(rawBody)
        .digest('hex');

      if (expectedSig !== receivedSig) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'Razorpay webhook: invalid signature — request rejected',
          })
        );
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      // ── Parse payload ────────────────────────────────────────────────────
      let event: RazorpayWebhookEvent;
      try {
        event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookEvent;
      } catch (err) {
        console.error(
          JSON.stringify({ level: 'error', message: 'Razorpay webhook: invalid JSON body', err })
        );
        res.status(400).json({ error: 'Invalid JSON' });
        return;
      }

      // ── Handle payment.captured ──────────────────────────────────────────
      if (event.event === 'payment.captured') {
        const payment = event.payload.payment.entity;
        const telegramIdStr = payment.notes?.telegram_id;
        const razorpayOrderId = payment.order_id;
        const razorpayPaymentId = payment.id;

        if (!telegramIdStr) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'Razorpay webhook: payment.captured missing telegram_id in notes',
              paymentId: razorpayPaymentId,
            })
          );
          res.status(200).json({ received: true });
          return;
        }

        const telegramId = parseInt(telegramIdStr, 10);

        try {
          const user = await getUserByTelegramId(telegramId);

          if (!user) {
            console.error(
              JSON.stringify({
                level: 'error',
                message: 'Razorpay webhook: user not found for telegram_id',
                telegramId,
              })
            );
            res.status(200).json({ received: true });
            return;
          }

          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await upgradeUserToPremium(telegramId, expiresAt);

          await insertPayment({
            userId: user.id,
            razorpayOrderId,
            razorpayPaymentId,
            amount: 9900,
            currency: 'INR',
            status: 'captured',
          });

          await sendMessage(
            telegramId,
            '⭐ Premium activated! You now have access to all 4 languages, no ads, and pre/post match reports.'
          );

          console.log(
            JSON.stringify({
              level: 'info',
              message: 'Premium activated via webhook',
              telegramId,
              razorpayOrderId,
              expiresAt,
            })
          );
        } catch (err) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'Razorpay webhook: error processing payment.captured',
              telegramId,
              err,
            })
          );
        }

        res.status(200).json({ received: true });
        return;
      }

      // ── Handle payment.failed ────────────────────────────────────────────
      if (event.event === 'payment.failed') {
        const payment = event.payload.payment.entity;
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'Razorpay webhook: payment.failed received — no action taken',
            paymentId: payment.id,
            orderId: payment.order_id,
          })
        );
        res.status(200).json({ received: true });
        return;
      }

      // ── Unhandled event type ─────────────────────────────────────────────
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'Razorpay webhook: unhandled event type',
          eventType: event.event,
        })
      );
      res.status(200).json({ received: true });
    }
  );
}

// ── Task 12.3: startSubscriptionCron ─────────────────────────────────────────

/**
 * Start the subscription management cron jobs:
 *   1. Daily at midnight — downgrade expired premium users and notify them.
 *   2. Every 5 minutes — send pre-match reports to premium subscribers 30 min before kick-off.
 *
 * Requirements: 6.5, 6.6, 12.6
 */
export function startSubscriptionCron(): void {
  // ── Daily expiry cron ─────────────────────────────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log(
      JSON.stringify({ level: 'info', message: 'Subscription cron: checking expired premiums' })
    );

    try {
      const downgraded = await downgradeExpiredPremiumUsers();

      for (const user of downgraded) {
        try {
          await sendMessage(
            user.telegram_id,
            'Your MatchCast Premium subscription has expired. Renew with /premium to continue enjoying all 4 languages and no ads.'
          );
        } catch (err) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'Subscription cron: failed to notify expired user',
              telegramId: user.telegram_id,
              err,
            })
          );
        }
      }

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'Subscription cron: expiry check complete',
          downgradedCount: downgraded.length,
        })
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Subscription cron: expiry check failed',
          err,
        })
      );
    }
  });

  // ── Pre-match report cron (every 5 minutes) ───────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = Date.now();
      const windowStart = new Date(now + 25 * 60 * 1000).toISOString(); // now + 25 min
      const windowEnd = new Date(now + 35 * 60 * 1000).toISOString();   // now + 35 min

      // Fetch matches with kickoff_at in the 30-minute pre-match window
      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('kickoff_at', windowStart)
        .lte('kickoff_at', windowEnd);

      if (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'Pre-match cron: failed to fetch upcoming matches',
            error,
          })
        );
        return;
      }

      for (const matchRow of (matches ?? []) as Match[]) {
        // Fetch premium subscribers for this fixture
        const subscribers = await getSubscribersForMatch(matchRow.fixture_id);
        const premiumSubscribers = subscribers.filter((s) => s.tier === 'premium');

        if (premiumSubscribers.length === 0) continue;

        for (const subscriber of premiumSubscribers) {
          try {
            const result = await generateSummary({
              match: matchRow,
              language: subscriber.language,
            });

            await sendMessage(
              subscriber.telegram_id,
              `🔮 Pre-Match Report\n\n${result.text}`
            );
          } catch (err) {
            console.error(
              JSON.stringify({
                level: 'error',
                message: 'Pre-match cron: failed to send pre-match report',
                telegramId: subscriber.telegram_id,
                fixtureId: matchRow.fixture_id,
                err,
              })
            );
          }
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Pre-match cron: unexpected error',
          err,
        })
      );
    }
  });

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Subscription crons started (expiry: 0 0 * * *, pre-match: */5 * * * *)',
    })
  );
}

// ── Razorpay webhook payload types ────────────────────────────────────────────

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: {
    telegram_id?: string;
    [key: string]: string | undefined;
  };
}

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment: {
      entity: RazorpayPaymentEntity;
    };
  };
}
