/**
 * Check whether a fingerprint already exists in the deduplication store.
 * Returns true if it exists, false otherwise.
 */
export declare function checkFingerprint(fingerprint: string): Promise<boolean>;
/**
 * Insert a new fingerprint record to mark an event as processed.
 */
export declare function insertFingerprint(data: {
    fingerprint: string;
    fixtureId: number;
    eventType: string;
    eventMinute: number;
}): Promise<void>;
//# sourceMappingURL=fingerprints.d.ts.map