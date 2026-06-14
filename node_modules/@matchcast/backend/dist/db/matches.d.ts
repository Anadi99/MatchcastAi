import type { Match, MatchStatus } from '../types/db';
/**
 * Insert or update a match record by fixture_id.
 */
export declare function upsertMatch(fixture: Omit<Match, 'id' | 'created_at' | 'updated_at'>): Promise<Match>;
/**
 * Return all matches currently in 'live' status.
 */
export declare function getLiveMatches(): Promise<Match[]>;
/**
 * Return all matches with a kickoff_at date equal to today (UTC).
 */
export declare function getTodayMatches(): Promise<Match[]>;
/**
 * Update the status of a match identified by its API-Football fixture ID.
 */
export declare function updateMatchStatus(fixtureId: number, status: MatchStatus): Promise<void>;
//# sourceMappingURL=matches.d.ts.map