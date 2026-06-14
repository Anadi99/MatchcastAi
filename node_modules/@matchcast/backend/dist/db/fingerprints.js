"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFingerprint = checkFingerprint;
exports.insertFingerprint = insertFingerprint;
const client_1 = require("./client");
/**
 * Check whether a fingerprint already exists in the deduplication store.
 * Returns true if it exists, false otherwise.
 */
async function checkFingerprint(fingerprint) {
    const { data, error } = await client_1.supabase
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
async function insertFingerprint(data) {
    const { error } = await client_1.supabase.from('event_fingerprints').insert({
        fingerprint: data.fingerprint,
        fixture_id: data.fixtureId,
        event_type: data.eventType,
        event_minute: data.eventMinute,
    });
    if (error) {
        throw new Error(`insertFingerprint failed for fingerprint="${data.fingerprint}": ${error.message}`);
    }
}
//# sourceMappingURL=fingerprints.js.map