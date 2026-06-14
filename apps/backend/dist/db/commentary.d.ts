import type { CommentaryUpdate, Language } from '../types/db';
/**
 * Persist a new commentary update row.
 */
export declare function insertCommentaryUpdate(update: Omit<CommentaryUpdate, 'id' | 'created_at'>): Promise<void>;
/**
 * Retrieve the most recent commentary updates for a match in a given language.
 * Results are ordered by created_at descending (newest first).
 */
export declare function getCommentaryForMatch(fixtureId: number, language: Language, limit: number): Promise<CommentaryUpdate[]>;
//# sourceMappingURL=commentary.d.ts.map