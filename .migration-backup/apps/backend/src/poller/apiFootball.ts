import axios from 'axios';

// ── Custom error ─────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(message = 'API-Football rate limit exceeded (HTTP 429)') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ── Response interfaces ───────────────────────────────────────────────────────

export interface ApiFixture {
  fixture: { id: number; date: string; venue: { name: string } };
  league: { id: number; season: number };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
  /** Status codes: NS, 1H, HT, 2H, ET, P, BT, FT, AET, PEN, SUSP, INT, PST, CANC, ABD, AWD, WO */
  fixture_status: { short: string };
}

export interface ApiEvent {
  time: { elapsed: number };
  team: { name: string };
  player: { name: string };
  type: string;   // 'Goal' | 'Card' | 'subst' | 'Var'
  detail: string; // e.g. 'Normal Goal', 'Yellow Card'
}

export interface ApiStatistic {
  team: { name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

// ── Axios client ──────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'X-RapidAPI-Key': process.env.API_FOOTBALL_KEY ?? '',
  },
  timeout: 10_000,
});

// Intercept 429 responses and throw RateLimitError
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new RateLimitError();
    }
    throw error;
  },
);

// ── Public fetch functions ────────────────────────────────────────────────────

/**
 * Fetch all World Cup 2026 fixtures for a given date (YYYY-MM-DD).
 * League 1 = FIFA World Cup.
 */
export async function fetchDailyFixtures(date: string): Promise<ApiFixture[]> {
  const response = await client.get<{ response: ApiFixture[] }>('/fixtures', {
    params: { date, league: 1, season: 2026 },
  });
  return response.data.response ?? [];
}

/**
 * Fetch all live events for a given fixture ID.
 */
export async function fetchMatchEvents(fixtureId: number): Promise<ApiEvent[]> {
  const response = await client.get<{ response: ApiEvent[] }>('/fixtures/events', {
    params: { fixture: fixtureId },
  });
  return response.data.response ?? [];
}

/**
 * Fetch team statistics for a given fixture ID.
 */
export async function fetchMatchStatistics(fixtureId: number): Promise<ApiStatistic[]> {
  const response = await client.get<{ response: ApiStatistic[] }>('/fixtures/statistics', {
    params: { fixture: fixtureId },
  });
  return response.data.response ?? [];
}
