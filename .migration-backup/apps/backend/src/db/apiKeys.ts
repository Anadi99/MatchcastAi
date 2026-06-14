import crypto from 'node:crypto';
import { supabase } from './client';
import type { ApiKey } from '../types/db';

/**
 * Hash a raw API key string with SHA-256.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Look up an API key by its hash; update last_used_at; return null if not found or inactive.
 */
export async function getApiKey(keyHash: string): Promise<ApiKey | null> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  // Update last_used_at asynchronously — don't block the request
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {
      // fire-and-forget: ignore result
    });

  return data as ApiKey;
}
