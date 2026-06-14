import { supabase } from './client';
import type { User, Match } from '../types/db';

/**
 * Subscribe a user to a match. Silently ignores if the subscription already exists.
 */
export async function addSubscription(userId: string, matchId: string): Promise<void> {
  const { error } = await supabase
    .from('match_subscriptions')
    .upsert({ user_id: userId, match_id: matchId }, { onConflict: 'user_id,match_id' });

  if (error) {
    throw new Error(
      `addSubscription failed for user_id=${userId}, match_id=${matchId}: ${error.message}`
    );
  }
}

/**
 * Remove a subscription for a user and match pair.
 */
export async function removeSubscription(userId: string, matchId: string): Promise<void> {
  const { error } = await supabase
    .from('match_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('match_id', matchId);

  if (error) {
    throw new Error(
      `removeSubscription failed for user_id=${userId}, match_id=${matchId}: ${error.message}`
    );
  }
}

/**
 * Return all subscribers for a match identified by its API-Football fixture ID.
 * Joins match_subscriptions → users → matches on fixture_id.
 * Returns the id, telegram_id, language, and tier of each subscriber.
 */
export async function getSubscribersForMatch(
  fixtureId: number
): Promise<Array<Pick<User, 'id' | 'telegram_id' | 'language' | 'tier'>>> {
  const { data, error } = await supabase
    .from('match_subscriptions')
    .select(
      `users!inner ( id, telegram_id, language, tier ),
       matches!inner ( fixture_id )`
    )
    .eq('matches.fixture_id', fixtureId);

  if (error) {
    throw new Error(`getSubscribersForMatch failed for fixture_id=${fixtureId}: ${error.message}`);
  }

  // Flatten the nested join result into the expected shape.
  // Supabase returns joined rows as arrays; cast through unknown to satisfy TypeScript.
  return ((data ?? []) as unknown as Array<{
    users: Pick<User, 'id' | 'telegram_id' | 'language' | 'tier'>;
  }>).map((row) => ({
    id: row.users.id,
    telegram_id: row.users.telegram_id,
    language: row.users.language,
    tier: row.users.tier,
  }));
}

/**
 * Return all matches a user is subscribed to.
 */
export async function getSubscriptionsForUser(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('match_subscriptions')
    .select('matches!inner ( * )')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`getSubscriptionsForUser failed for user_id=${userId}: ${error.message}`);
  }

  // Flatten the nested join result — each row has a `matches` object.
  // Supabase returns joined rows as arrays; cast through unknown to satisfy TypeScript.
  return ((data ?? []) as unknown as Array<{ matches: Match }>).map((row) => row.matches);
}
