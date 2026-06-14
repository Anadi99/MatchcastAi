"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSubscription = addSubscription;
exports.removeSubscription = removeSubscription;
exports.getSubscribersForMatch = getSubscribersForMatch;
exports.getSubscriptionsForUser = getSubscriptionsForUser;
const client_1 = require("./client");
/**
 * Subscribe a user to a match. Silently ignores if the subscription already exists.
 */
async function addSubscription(userId, matchId) {
    const { error } = await client_1.supabase
        .from('match_subscriptions')
        .upsert({ user_id: userId, match_id: matchId }, { onConflict: 'user_id,match_id' });
    if (error) {
        throw new Error(`addSubscription failed for user_id=${userId}, match_id=${matchId}: ${error.message}`);
    }
}
/**
 * Remove a subscription for a user and match pair.
 */
async function removeSubscription(userId, matchId) {
    const { error } = await client_1.supabase
        .from('match_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('match_id', matchId);
    if (error) {
        throw new Error(`removeSubscription failed for user_id=${userId}, match_id=${matchId}: ${error.message}`);
    }
}
/**
 * Return all subscribers for a match identified by its API-Football fixture ID.
 * Joins match_subscriptions → users → matches on fixture_id.
 * Returns the id, telegram_id, language, and tier of each subscriber.
 */
async function getSubscribersForMatch(fixtureId) {
    const { data, error } = await client_1.supabase
        .from('match_subscriptions')
        .select(`users!inner ( id, telegram_id, language, tier ),
       matches!inner ( fixture_id )`)
        .eq('matches.fixture_id', fixtureId);
    if (error) {
        throw new Error(`getSubscribersForMatch failed for fixture_id=${fixtureId}: ${error.message}`);
    }
    // Flatten the nested join result into the expected shape.
    // Supabase returns joined rows as arrays; cast through unknown to satisfy TypeScript.
    return (data ?? []).map((row) => ({
        id: row.users.id,
        telegram_id: row.users.telegram_id,
        language: row.users.language,
        tier: row.users.tier,
    }));
}
/**
 * Return all matches a user is subscribed to.
 */
async function getSubscriptionsForUser(userId) {
    const { data, error } = await client_1.supabase
        .from('match_subscriptions')
        .select('matches!inner ( * )')
        .eq('user_id', userId);
    if (error) {
        throw new Error(`getSubscriptionsForUser failed for user_id=${userId}: ${error.message}`);
    }
    // Flatten the nested join result — each row has a `matches` object.
    // Supabase returns joined rows as arrays; cast through unknown to satisfy TypeScript.
    return (data ?? []).map((row) => row.matches);
}
//# sourceMappingURL=subscriptions.js.map