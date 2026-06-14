import cron from 'node-cron';
import { getActiveSponsor, insertSponsorDelivery } from '../db/sponsors';
import type { Sponsor } from '../types/db';

// ── In-memory state ───────────────────────────────────────────────────────────

/**
 * Tracks how many updates have been delivered to each user per fixture.
 * Key: `${telegramId}:${fixtureId}`, Value: delivery count so far.
 *
 * Requirements: 5.1
 */
const userUpdateCounters = new Map<string, number>();

/**
 * Cached active sponsor, refreshed at startup and every 5 minutes.
 *
 * Requirements: 5.2, 5.3
 */
let activeSponsor: Sponsor | null = null;

// ── Sponsor refresh ───────────────────────────────────────────────────────────

async function refreshActiveSponsor(): Promise<void> {
  try {
    const sponsor = await getActiveSponsor();
    activeSponsor = sponsor;

    if (sponsor !== null) {
      console.log(`[SponsorInjector] Active sponsor loaded: "${sponsor.name}"`);
    } else {
      console.log('[SponsorInjector] No active sponsor — injection disabled.');
    }
  } catch (err) {
    console.error('[SponsorInjector] Failed to refresh active sponsor:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the sponsor injector:
 * - Fetches the active sponsor immediately at startup.
 * - Schedules a refresh every 5 minutes via node-cron.
 *
 * Requirements: 5.2
 */
export function startSponsorInjector(): void {
  // Refresh immediately on startup
  void refreshActiveSponsor();

  // Schedule refresh every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    void refreshActiveSponsor();
  });

  console.log('[SponsorInjector] Started — refresh scheduled every 5 minutes.');
}

/**
 * Maybe inject a sponsor message into the update text.
 *
 * - Skips injection for premium users (Requirement 5.5).
 * - Increments a per-user/per-fixture counter and injects on every 4th update (Requirement 5.1).
 * - Skips injection when no active sponsor exists (Requirement 5.3).
 * - Appends sponsor content with a visible delimiter (Requirement 5.4).
 * - Records each delivery to Supabase for sponsor reporting (Requirement 5.6).
 *
 * @param user     Subscriber object with id (UUID), telegram_id, and tier.
 * @param text     The commentary text to potentially augment.
 * @param fixtureId The fixture/match ID for counter scoping.
 * @returns The original text, or the text with sponsor content appended.
 */
export async function maybeInject(
  user: { id: string; telegram_id: number; tier: string },
  text: string,
  fixtureId: number,
): Promise<string> {
  // Requirement 5.5: suppress sponsor messages for premium users
  if (user.tier === 'premium') {
    return text;
  }

  const key = `${user.telegram_id}:${fixtureId}`;
  const count = (userUpdateCounters.get(key) ?? 0) + 1;
  userUpdateCounters.set(key, count);

  // Inject on every 4th update when a sponsor is active
  if (count % 4 === 0 && activeSponsor !== null) {
    const sponsor = activeSponsor;

    const ctaPart = sponsor.cta_url ? `\n${sponsor.cta_url}` : '';
    const injected =
      `${text}\n\n──────────────────────\n💡 Sponsored by ${sponsor.name}\n${sponsor.message}${ctaPart}\n──────────────────────`;

    // Log delivery — do not throw on failure (Requirement 5.6)
    try {
      await insertSponsorDelivery(sponsor.id, user.id, fixtureId.toString());
    } catch (err) {
      console.error(
        `[SponsorInjector] Failed to record delivery for sponsor=${sponsor.id}, user=${user.id}:`,
        err,
      );
    }

    return injected;
  }

  return text;
}
