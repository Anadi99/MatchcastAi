import { supabase } from './client';
import type { User, Language } from '../types/db';

/**
 * Insert or update a user record by telegram_id.
 * On conflict, updates language and updated_at.
 */
export async function upsertUser(telegramId: number, language: Language): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { telegram_id: telegramId, language, updated_at: new Date().toISOString() },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`upsertUser failed for telegram_id=${telegramId}: ${error.message}`);
  }

  return data as User;
}

/**
 * Retrieve a user by their Telegram ID. Returns null if not found.
 */
export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`getUserByTelegramId failed for telegram_id=${telegramId}: ${error.message}`);
  }

  return data as User | null;
}

/**
 * Upgrade a user to premium tier with the given expiry date (ISO 8601 string).
 */
export async function upgradeUserToPremium(telegramId: number, expiresAt: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      tier: 'premium',
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_id', telegramId);

  if (error) {
    throw new Error(`upgradeUserToPremium failed for telegram_id=${telegramId}: ${error.message}`);
  }
}

/**
 * Downgrade all premium users whose subscription has expired.
 * Returns the list of affected users.
 */
export async function downgradeExpiredPremiumUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .update({ tier: 'free', updated_at: new Date().toISOString() })
    .eq('tier', 'premium')
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    throw new Error(`downgradeExpiredPremiumUsers failed: ${error.message}`);
  }

  return (data ?? []) as User[];
}
