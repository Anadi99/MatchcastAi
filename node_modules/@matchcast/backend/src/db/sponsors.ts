import { supabase } from './client';
import type { Sponsor } from '../types/db';

/**
 * Get the currently active sponsor (active_from <= now <= active_until).
 * Returns null if no active sponsor exists.
 *
 * Requirements: 5.2, 5.3
 */
export async function getActiveSponsor(): Promise<Sponsor | null> {
  const { data, error } = await supabase
    .from('sponsors')
    .select('*')
    .lte('active_from', new Date().toISOString())
    .gte('active_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Sponsor;
}

/**
 * Log a sponsor delivery event for reporting purposes.
 *
 * Requirements: 5.6
 */
export async function insertSponsorDelivery(
  sponsorId: string,
  userId: string,
  matchId: string | null,
): Promise<void> {
  const { error } = await supabase.from('sponsor_deliveries').insert({
    sponsor_id: sponsorId,
    user_id: userId,
    match_id: matchId,
  });

  if (error) {
    throw new Error(`insertSponsorDelivery failed: ${error.message}`);
  }
}
