import { supabase } from './client';
import type { Match, MatchStatus } from '../types/db';

/**
 * Insert or update a match record by fixture_id.
 */
export async function upsertMatch(fixture: Omit<Match, 'id' | 'created_at' | 'updated_at'>): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .upsert(fixture, { onConflict: 'fixture_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`upsertMatch failed for fixture_id=${fixture.fixture_id}: ${error.message}`);
  }

  return data as Match;
}

/**
 * Return all matches currently in 'live' status.
 */
export async function getLiveMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'live');

  if (error) {
    throw new Error(`getLiveMatches failed: ${error.message}`);
  }

  return (data ?? []) as Match[];
}

/**
 * Return all matches with a kickoff_at date equal to today (UTC).
 */
export async function getTodayMatches(): Promise<Match[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .gte('kickoff_at', `${today}T00:00:00.000Z`)
    .lt('kickoff_at', `${today}T23:59:59.999Z`)
    .order('kickoff_at', { ascending: true });

  if (error) {
    throw new Error(`getTodayMatches failed for date=${today}: ${error.message}`);
  }

  return (data ?? []) as Match[];
}

/**
 * Update the status of a match identified by its API-Football fixture ID.
 */
export async function updateMatchStatus(fixtureId: number, status: MatchStatus): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status })
    .eq('fixture_id', fixtureId);

  if (error) {
    throw new Error(`updateMatchStatus failed for fixture_id=${fixtureId}: ${error.message}`);
  }
}
