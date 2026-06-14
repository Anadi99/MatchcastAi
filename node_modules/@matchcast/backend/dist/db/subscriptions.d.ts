import type { User, Match } from '../types/db';
/**
 * Subscribe a user to a match. Silently ignores if the subscription already exists.
 */
export declare function addSubscription(userId: string, matchId: string): Promise<void>;
/**
 * Remove a subscription for a user and match pair.
 */
export declare function removeSubscription(userId: string, matchId: string): Promise<void>;
/**
 * Return all subscribers for a match identified by its API-Football fixture ID.
 * Joins match_subscriptions → users → matches on fixture_id.
 * Returns the id, telegram_id, language, and tier of each subscriber.
 */
export declare function getSubscribersForMatch(fixtureId: number): Promise<Array<Pick<User, 'id' | 'telegram_id' | 'language' | 'tier'>>>;
/**
 * Return all matches a user is subscribed to.
 */
export declare function getSubscriptionsForUser(userId: string): Promise<Match[]>;
//# sourceMappingURL=subscriptions.d.ts.map