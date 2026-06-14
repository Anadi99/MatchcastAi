import { supabase } from './client';
import type { CommentaryUpdate, Language } from '../types/db';

/**
 * Persist a new commentary update row.
 */
export async function insertCommentaryUpdate(
  update: Omit<CommentaryUpdate, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase
    .from('commentary_updates')
    .insert(update);

  if (error) {
    throw new Error(
      `insertCommentaryUpdate failed for fixture_id=${update.fixture_id}: ${error.message}`
    );
  }
}

/**
 * Retrieve the most recent commentary updates for a match in a given language.
 * Results are ordered by created_at descending (newest first).
 */
export async function getCommentaryForMatch(
  fixtureId: number,
  language: Language,
  limit: number
): Promise<CommentaryUpdate[]> {
  const { data, error } = await supabase
    .from('commentary_updates')
    .select('*')
    .eq('fixture_id', fixtureId)
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `getCommentaryForMatch failed for fixture_id=${fixtureId}, language=${language}: ${error.message}`
    );
  }

  return (data ?? []) as CommentaryUpdate[];
}
