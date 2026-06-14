import type { User, Language } from '../types/db';
/**
 * Insert or update a user record by telegram_id.
 * On conflict, updates language and updated_at.
 */
export declare function upsertUser(telegramId: number, language: Language): Promise<User>;
/**
 * Retrieve a user by their Telegram ID. Returns null if not found.
 */
export declare function getUserByTelegramId(telegramId: number): Promise<User | null>;
/**
 * Upgrade a user to premium tier with the given expiry date (ISO 8601 string).
 */
export declare function upgradeUserToPremium(telegramId: number, expiresAt: string): Promise<void>;
/**
 * Downgrade all premium users whose subscription has expired.
 * Returns the list of affected users.
 */
export declare function downgradeExpiredPremiumUsers(): Promise<User[]>;
//# sourceMappingURL=users.d.ts.map