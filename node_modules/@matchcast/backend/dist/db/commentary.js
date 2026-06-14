"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertCommentaryUpdate = insertCommentaryUpdate;
exports.getCommentaryForMatch = getCommentaryForMatch;
const client_1 = require("./client");
/**
 * Persist a new commentary update row.
 */
async function insertCommentaryUpdate(update) {
    const { error } = await client_1.supabase
        .from('commentary_updates')
        .insert(update);
    if (error) {
        throw new Error(`insertCommentaryUpdate failed for fixture_id=${update.fixture_id}: ${error.message}`);
    }
}
/**
 * Retrieve the most recent commentary updates for a match in a given language.
 * Results are ordered by created_at descending (newest first).
 */
async function getCommentaryForMatch(fixtureId, language, limit) {
    const { data, error } = await client_1.supabase
        .from('commentary_updates')
        .select('*')
        .eq('fixture_id', fixtureId)
        .eq('language', language)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        throw new Error(`getCommentaryForMatch failed for fixture_id=${fixtureId}, language=${language}: ${error.message}`);
    }
    return (data ?? []);
}
//# sourceMappingURL=commentary.js.map