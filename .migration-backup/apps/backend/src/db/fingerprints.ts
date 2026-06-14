import { supabase } from './client';

/**
 * Check whether a fingerprint already exists in the deduplication store.
 * Returns true if it exists, false otherwise.
 */
export async function checkFingerprint(fingerprint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_fingerprints')
    .select('id')
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (error) {
    throw new Error(`checkFingerprint failed for fingerprint="${fingerprint}": ${error.message}`);
  }

  return data !== null;
}

/**
 * Insert a new fingerprint record to mark an event as processed.
 */
export async function insertFingerprint(data: {
  fingerprint: string;
  fixtureId: number;
  eventType: string;
  eventMinute: number;
}): Promise<void> {
  const { error } = await supabase.from('event_fingerprints').insert({
    fingerprint: data.fingerprint,
    fixture_id: data.fixtureId,
    event_type: data.eventType,
    event_minute: data.eventMinute,
  });

  if (error) {
    throw new Error(
      `insertFingerprint failed for fingerprint="${data.fingerprint}": ${error.message}`
    );
  }
}
