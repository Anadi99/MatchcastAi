import cron from 'node-cron';
import { EventEmitter } from 'node:events';
import { fetchDailyFixtures, fetchMatchEvents, RateLimitError } from './apiFootball';
import type { ApiFixture, ApiEvent } from './apiFootball';
import { upsertMatch, getLiveMatches } from '../db/matches';
import type { Match, MatchStatus } from '../types/db';

// ── Status code mappings ──────────────────────────────────────────────────────

const LIVE_STATUS_CODES = new Set(['1H', 'HT', '2H', 'ET', 'P', 'BT']);
const FINISHED_STATUS_CODES = new Set([
  'FT', 'AET', 'PEN', 'SUSP', 'INT', 'PST', 'CANC', 'ABD', 'AWD', 'WO',
]);

function mapStatusCode(code: string): MatchStatus {
  if (LIVE_STATUS_CODES.has(code)) return 'live';
  if (FINISHED_STATUS_CODES.has(code)) return 'finished';
  return 'scheduled'; // 'NS' and anything unknown
}

// ── Singleton emitter ─────────────────────────────────────────────────────────

export const pollerEmitter = new EventEmitter();

// ── Internal state ────────────────────────────────────────────────────────────

/** Fixture IDs paused for 30 seconds after a 429 response. */
const pausedFixtures = new Set<number>();

/** Fixture IDs explicitly stopped (e.g. match finished, no longer need polling). */
const stoppedMatches = new Set<number>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function pauseFixture(fixtureId: number): void {
  pausedFixtures.add(fixtureId);
  setTimeout(() => {
    pausedFixtures.delete(fixtureId);
  }, 30_000);
}

function buildMatchUpsert(
  fixture: ApiFixture,
): Omit<Match, 'id' | 'created_at' | 'updated_at'> {
  return {
    fixture_id: fixture.fixture.id,
    home_team: fixture.teams.home.name,
    away_team: fixture.teams.away.name,
    home_score: fixture.goals.home ?? 0,
    away_score: fixture.goals.away ?? 0,
    venue: fixture.fixture.venue?.name ?? null,
    kickoff_at: fixture.fixture.date,
    status: mapStatusCode(fixture.fixture_status.short),
    league_id: fixture.league.id,
    season: fixture.league.season,
    last_polled_at: new Date().toISOString(),
  };
}

// ── Cron job: every 5 minutes — fetch & upsert daily fixtures ─────────────────

async function runFixturePoller(): Promise<void> {
  const date = today();
  let fixtures: ApiFixture[];

  try {
    fixtures = await fetchDailyFixtures(date);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn('[Poller] Rate limited fetching daily fixtures, skipping this cycle.');
      return;
    }
    console.error('[Poller] Error fetching daily fixtures:', err);
    return;
  }

  for (const fixture of fixtures) {
    try {
      const matchData = buildMatchUpsert(fixture);
      await upsertMatch(matchData);
    } catch (err) {
      console.error(
        `[Poller] Error upserting fixture ${fixture.fixture.id}:`,
        err,
      );
    }
  }

  console.log(`[Poller] Upserted ${fixtures.length} fixtures for ${date}.`);
}

// ── Cron job: every minute — poll live match events ───────────────────────────

async function runLivePoller(): Promise<void> {
  let liveMatches: Match[];

  try {
    liveMatches = await getLiveMatches();
  } catch (err) {
    console.error('[Poller] Error fetching live matches:', err);
    return;
  }

  for (const match of liveMatches) {
    const { fixture_id: fixtureId } = match;

    if (stoppedMatches.has(fixtureId) || pausedFixtures.has(fixtureId)) {
      continue;
    }

    let events: ApiEvent[];

    try {
      events = await fetchMatchEvents(fixtureId);
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.warn(`[Poller] Rate limited on fixture ${fixtureId}, pausing 30s.`);
        pauseFixture(fixtureId);
        continue;
      }
      console.error(`[Poller] Error fetching events for fixture ${fixtureId}:`, err);
      continue;
    }

    // Emit events for the commentary pipeline
    pollerEmitter.emit('eventsReady', { fixtureId, events, match });

    // If the match has finished, emit matchFinished
    if (match.status === 'finished') {
      pollerEmitter.emit('matchFinished', { fixtureId });
    }
  }
}

// ── Export: stop polling a specific match ─────────────────────────────────────

/**
 * Permanently stop polling events for a finished (or unsubscribed) match.
 */
export function stopPollingForMatch(fixtureId: number): void {
  stoppedMatches.add(fixtureId);
}

// ── Export: start all cron jobs ───────────────────────────────────────────────

export function startPoller(): void {
  // Immediate startup recovery: resume polling for any already-live matches
  getLiveMatches()
    .then((liveMatches) => {
      if (liveMatches.length > 0) {
        console.log(
          `[Poller] Resuming live polling for ${liveMatches.length} in-progress match(es).`,
        );
      }
    })
    .catch((err) => {
      console.error('[Poller] Startup recovery: failed to fetch live matches:', err);
    });

  // Every 5 minutes: fetch today's fixtures and upsert to DB
  cron.schedule('*/5 * * * *', () => {
    runFixturePoller().catch((err) => {
      console.error('[Poller] Unhandled error in fixture poller:', err);
    });
  });

  // Every minute: poll events for all currently live matches
  cron.schedule('* * * * *', () => {
    runLivePoller().catch((err) => {
      console.error('[Poller] Unhandled error in live poller:', err);
    });
  });

  console.log('[Poller] Cron jobs started.');
}
