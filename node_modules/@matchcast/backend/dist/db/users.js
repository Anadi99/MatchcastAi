"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertUser = upsertUser;
exports.getUserByTelegramId = getUserByTelegramId;
exports.upgradeUserToPremium = upgradeUserToPremium;
exports.downgradeExpiredPremiumUsers = downgradeExpiredPremiumUsers;
const client_1 = require("./client");
/**
 * Insert or update a user record by telegram_id.
 * On conflict, updates language and updated_at.
 */
async function upsertUser(telegramId, language) {
    const { data, error } = await client_1.supabase
        .from('users')
        .upsert({ telegram_id: telegramId, language, updated_at: new Date().toISOString() }, { onConflict: 'telegram_id' })
        .select()
        .single();
    if (error) {
        throw new Error(`upsertUser failed for telegram_id=${telegramId}: ${error.message}`);
    }
    return data;
}
/**
 * Retrieve a user by their Telegram ID. Returns null if not found.
 */
async function getUserByTelegramId(telegramId) {
    const { data, error } = await client_1.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();
    if (error) {
        throw new Error(`getUserByTelegramId failed for telegram_id=${telegramId}: ${error.message}`);
    }
    return data;
}
/**
 * Upgrade a user to premium tier with the given expiry date (ISO 8601 string).
 */
async function upgradeUserToPremium(telegramId, expiresAt) {
    const { error } = await client_1.supabase
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
async function downgradeExpiredPremiumUsers() {
    const { data, error } = await client_1.supabase
        .from('users')
        .update({ tier: 'free', updated_at: new Date().toISOString() })
        .eq('tier', 'premium')
        .lt('expires_at', new Date().toISOString())
        .select();
    if (error) {
        throw new Error(`downgradeExpiredPremiumUsers failed: ${error.message}`);
    }
    return (data ?? []);
}
//# sourceMappingURL=users.js.map