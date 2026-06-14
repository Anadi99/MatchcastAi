import { processorEmitter } from './processor';
import { generate, generatePulse, generateSummary } from '../commentary/engine';
import { getSubscribersForMatch } from '../db/subscriptions';
import { insertCommentaryUpdate } from '../db/commentary';
import { sendMessage } from '../bot';
import { stopPollingForMatch } from '../poller';
import { updateMatchStatus } from '../db/matches';
import { maybeInject } from '../sponsors/injector';
import { supabase } from '../db/client';
import type { MatchEventPayload, Match } from '../types/db';
import type { ApiStatistic } from '../poller/apiFootball';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a match UUID from API-Football fixture ID.
 * Uses an in-memory cache to avoid redundant DB queries per delivery cycle.
 */
const matchIdCache = new Map<number, string>();

async function getMatchIdByFixtureId(fixtureId: number): Promise<string | null> {
  const cached = matchIdCache.get(fixtureId);
  if (cached !== undefined) {
    return cached;
  }

  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('fixture_id', fixtureId)
    .single();

  if (error || !data) {
    return null;
  }

  const matchId = (data as { id: string }).id;
  matchIdCache.set(fixtureId, matchId);
  return matchId;
}

/**
 * Fetch a full Match record by fixture ID.
 */
async function getMatchByFixtureId(fixtureId: number): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('fixture_id', fixtureId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Match;
}

// ── Delivery Service ──────────────────────────────────────────────────────────

/**
 * Register all delivery listeners on processorEmitter.
 * This is the central pipeline: events → commentary → sponsor injection → Telegram delivery.
 *
 * Requirements: 2.1, 3.2, 4.1, 4.4, 4.5, 9.5, 10.4
 */
export function startDeliveryService(): void {
  // ── 1. newEvent ──────────────────────────────────────────────────────────
  processorEmitter.on('newEvent', async (payload: MatchEventPayload) => {
    try {
      const subscribers = await getSubscribersForMatch(payload.fixtureId);
      const matchId = await getMatchIdByFixtureId(payload.fixtureId);

      for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];

        if (i > 0) {
          await sleep(34);
        }

        let result;
        try {
          result = await generate(payload, subscriber.language);
        } catch (err) {
          console.error(
            `[DeliveryService] generate failed for fixture=${payload.fixtureId}, user=${subscriber.telegram_id}:`,
            err,
          );
          continue;
        }

        const finalText = await maybeInject(subscriber, result.text, payload.fixtureId);

        try {
          await sendMessage(subscriber.telegram_id, finalText);
        } catch (err) {
          console.error(
            `[DeliveryService] sendMessage failed for telegram_id=${subscriber.telegram_id}:`,
            err,
          );
        }

        if (matchId !== null) {
          try {
            await insertCommentaryUpdate({
              match_id: matchId,
              fixture_id: payload.fixtureId,
              language: subscriber.language,
              event_type: payload.eventType,
              event_minute: payload.minute,
              content: result.text,
              word_count: result.wordCount,
              is_summary: false,
            });
          } catch (err) {
            console.error(
              `[DeliveryService] insertCommentaryUpdate failed for fixture=${payload.fixtureId}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error('[DeliveryService] Unhandled error in newEvent handler:', err);
    }
  });

  // ── 2. pulseRequired ─────────────────────────────────────────────────────
  processorEmitter.on(
    'pulseRequired',
    async (data: { fixtureId: number; match: Match; statistics: ApiStatistic[] }) => {
      const { fixtureId, match, statistics } = data;

      try {
        const subscribers = await getSubscribersForMatch(fixtureId);
        const matchId = await getMatchIdByFixtureId(fixtureId);

        for (let i = 0; i < subscribers.length; i++) {
          const subscriber = subscribers[i];

          if (i > 0) {
            await sleep(34);
          }

          let result;
          try {
            result = await generatePulse({ fixtureId, match, statistics }, subscriber.language);
          } catch (err) {
            console.error(
              `[DeliveryService] generatePulse failed for fixture=${fixtureId}, user=${subscriber.telegram_id}:`,
              err,
            );
            continue;
          }

          const finalText = await maybeInject(subscriber, result.text, fixtureId);

          try {
            await sendMessage(subscriber.telegram_id, finalText);
          } catch (err) {
            console.error(
              `[DeliveryService] sendMessage failed for telegram_id=${subscriber.telegram_id}:`,
              err,
            );
          }

          if (matchId !== null) {
            try {
              await insertCommentaryUpdate({
                match_id: matchId,
                fixture_id: fixtureId,
                language: subscriber.language,
                event_type: 'pulse',
                event_minute: null,
                content: result.text,
                word_count: result.wordCount,
                is_summary: false,
              });
            } catch (err) {
              console.error(
                `[DeliveryService] insertCommentaryUpdate (pulse) failed for fixture=${fixtureId}:`,
                err,
              );
            }
          }
        }
      } catch (err) {
        console.error('[DeliveryService] Unhandled error in pulseRequired handler:', err);
      }
    },
  );

  // ── 3. matchFinished ─────────────────────────────────────────────────────
  processorEmitter.on('matchFinished', async (data: { fixtureId: number }) => {
    const { fixtureId } = data;

    try {
      const subscribers = await getSubscribersForMatch(fixtureId);
      const match = await getMatchByFixtureId(fixtureId);
      const matchId = match?.id ?? null;

      if (match === null) {
        console.error(
          `[DeliveryService] matchFinished: could not fetch match for fixture=${fixtureId}`,
        );
        return;
      }

      for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];

        if (i > 0) {
          await sleep(34);
        }

        let result;
        try {
          result = await generateSummary({ match, language: subscriber.language });
        } catch (err) {
          console.error(
            `[DeliveryService] generateSummary failed for fixture=${fixtureId}, user=${subscriber.telegram_id}:`,
            err,
          );
          continue;
        }

        const injectedText = await maybeInject(subscriber, result.text, fixtureId);

        // Append share-ready plain text (Requirement 4.5)
        const shareFooter =
          `\n\n📤 Share: ${match.home_team} ${match.home_score}–${match.away_score} ${match.away_team} | WC 2026 #MatchCastAI`;
        const finalText = injectedText + shareFooter;

        try {
          await sendMessage(subscriber.telegram_id, finalText);
        } catch (err) {
          console.error(
            `[DeliveryService] sendMessage failed for telegram_id=${subscriber.telegram_id}:`,
            err,
          );
        }

        if (matchId !== null) {
          try {
            await insertCommentaryUpdate({
              match_id: matchId,
              fixture_id: fixtureId,
              language: subscriber.language,
              event_type: 'summary',
              event_minute: null,
              content: result.text,
              word_count: result.wordCount,
              is_summary: true,
            });
          } catch (err) {
            console.error(
              `[DeliveryService] insertCommentaryUpdate (summary) failed for fixture=${fixtureId}:`,
              err,
            );
          }
        }
      }

      // Stop polling and mark match as finished (Requirements 3.6, 10.4)
      stopPollingForMatch(fixtureId);

      try {
        await updateMatchStatus(fixtureId, 'finished');
      } catch (err) {
        console.error(
          `[DeliveryService] updateMatchStatus failed for fixture=${fixtureId}:`,
          err,
        );
      }
    } catch (err) {
      console.error('[DeliveryService] Unhandled error in matchFinished handler:', err);
    }
  });

  console.log('[DeliveryService] Listening for processor events.');
}
