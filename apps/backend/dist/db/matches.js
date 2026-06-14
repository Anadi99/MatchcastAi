"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMatch = upsertMatch;
exports.getLiveMatches = getLiveMatches;
exports.getTodayMatches = getTodayMatches;
exports.updateMatchStatus = updateMatchStatus;
const client_1 = require("./client");
/**
 * Insert or update a match record by fixture_id.
 */
async function upsertMatch(fixture) {
    const { data, error } = await client_1.supabase
        .from('matches')
        .upsert(fixture, { onConflict: 'fixture_id' })
        .select()
        .single();
    if (error) {
        throw new Error(`upsertMatch failed for fixture_id=${fixture.fixture_id}: ${error.message}`);
    }
    return data;
}
/**
 * Return all matches currently in 'live' status.
 */
async function getLiveMatches() {
    const { data, error } = await client_1.supabase
        .from('matches')
        .select('*')
        .eq('status', 'live');
    if (error) {
        throw new Error(`getLiveMatches failed: ${error.message}`);
    }
    return (data ?? []);
}
/**
 * Return all matches with a kickoff_at date equal to today (UTC).
 */
async function getTodayMatches() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data, error } = await client_1.supabase
        .from('matches')
        .select('*')
        .gte('kickoff_at', `${today}T00:00:00.000Z`)
        .lt('kickoff_at', `${today}T23:59:59.999Z`)
        .order('kickoff_at', { ascending: true });
    if (error) {
        throw new Error(`getTodayMatches failed for date=${today}: ${error.message}`);
    }
    return (data ?? []);
}
/**
 * Update the status of a match identified by its API-Football fixture ID.
 */
async function updateMatchStatus(fixtureId, status) {
    const { error } = await client_1.supabase
        .from('matches')
        .update({ status })
        .eq('fixture_id', fixtureId);
    if (error) {
        throw new Error(`updateMatchStatus failed for fixture_id=${fixtureId}: ${error.message}`);
    }
}
//# sourceMappingURL=matches.js.map