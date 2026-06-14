import { EventEmitter } from 'node:events';
import { pollerEmitter } from '../poller';
import { checkFingerprint, insertFingerprint } from '../db/fingerprints';
import { fetchMatchStatistics } from '../poller/apiFootball';
import type { ApiEvent } from '../poller/apiFootball';
import type { Match, MatchEventPayload, EventType } from '../types/db';

// ── Singleton emitter ─────────────────────────────────────────────────────────

export const processorEmitter = new EventEmitter();

// ── Internal state ────────────────────────────────────────────────────────────

/** Tracks the timestamp (ms) of the last event emission per fixtureId. */
const lastEmissionTime = new Map<number, number>();

// ── Event type mapping ────────────────────────────────────────────────────────

const EVENT_TYPE_MAP: Record<string, EventType> = {
  Goal: 'goal',
  Card: 'card',
  subst: 'subst',
  Var: 'var',
};

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleEventsReady(payload: {
  fixtureId: number;
  events: ApiEvent[];
  match: Match;
}): Promise<void> {
  const { fixtureId, events, match } = payload;
  let emittedThisCycle = false;

  // Process events in the order returned by API-Football (Requirement 9.5)
  for (const event of events) {
    const mappedType = EVENT_TYPE_MAP[event.type];

    // Skip unrecognised event types
    if (mappedType === undefined) {
      continue;
    }

    const elapsed = event.time.elapsed;
    const teamName = event.team?.name ?? '';
    const playerName = event.player?.name ?? '';

    // Build fingerprint: {fixtureId}:{mappedType}:{elapsed}:{teamName}:{playerName}
    const fingerprint = `${fixtureId}:${mappedType}:${elapsed}:${teamName}:${playerName}`;

    // Deduplicate — if this fingerprint already exists, skip (Requirements 9.3, 9.4)
    let exists: boolean;
    try {
      exists = await checkFingerprint(fingerprint);
    } catch (err) {
      console.error(`[EventProcessor] checkFingerprint error for "${fingerprint}":`, err);
      continue;
    }

    if (exists) {
      continue;
    }

    // Insert fingerprint to mark this event as processed
    try {
      await insertFingerprint({
        fingerprint,
        fixtureId,
        eventType: mappedType,
        eventMinute: elapsed,
      });
    } catch (err) {
      console.error(`[EventProcessor] insertFingerprint error for "${fingerprint}":`, err);
      continue;
    }

    // Build MatchEventPayload and emit newEvent (Requirement 2.8)
    const matchEventPayload: MatchEventPayload = {
      fixtureId,
      eventType: mappedType,
      eventDetail: event.detail,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      homeScore: match.home_score,
      awayScore: match.away_score,
      minute: elapsed,
      venue: match.venue ?? '',
      language: 'hi', // placeholder — Delivery_Service will use per-subscriber language
    };

    processorEmitter.emit('newEvent', matchEventPayload);

    lastEmissionTime.set(fixtureId, Date.now());
    emittedThisCycle = true;
  }

  // After processing all events, check whether a pulse update is needed
  const lastEmitted = lastEmissionTime.get(fixtureId);
  const now = Date.now();
  const secondsSinceLastEmission = lastEmitted !== undefined ? (now - lastEmitted) / 1000 : Infinity;

  if (secondsSinceLastEmission >= 60) {
    // No new events in the last 60 seconds — fetch statistics and emit a pulse
    try {
      const statistics = await fetchMatchStatistics(fixtureId);
      processorEmitter.emit('pulseRequired', { fixtureId, match, statistics });
    } catch (err) {
      console.error(`[EventProcessor] fetchMatchStatistics error for fixture ${fixtureId}:`, err);
    }

    // Update last emission time regardless of whether stats fetch succeeded
    lastEmissionTime.set(fixtureId, now);
  } else if (emittedThisCycle) {
    // Already updated inside the loop, nothing extra needed here
    // (lastEmissionTime was set when emitting newEvent)
  }
}

function handleMatchFinished(payload: { fixtureId: number }): void {
  processorEmitter.emit('matchFinished', { fixtureId: payload.fixtureId });
}

// ── Public: register listeners on pollerEmitter ───────────────────────────────

export function startEventProcessor(): void {
  pollerEmitter.on('eventsReady', (payload: { fixtureId: number; events: ApiEvent[]; match: Match }) => {
    handleEventsReady(payload).catch((err) => {
      console.error('[EventProcessor] Unhandled error in eventsReady handler:', err);
    });
  });

  pollerEmitter.on('matchFinished', (payload: { fixtureId: number }) => {
    handleMatchFinished(payload);
  });

  console.log('[EventProcessor] Listening for poller events.');
}
