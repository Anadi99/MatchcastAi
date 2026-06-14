export type Language = 'hi' | 'ta' | 'te' | 'mr';
export type UserTier = 'free' | 'premium';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type EventType = 'goal' | 'card' | 'subst' | 'var' | 'pulse' | 'summary' | 'pre_match';
export type PaymentStatus = 'pending' | 'captured' | 'failed' | 'refunded';
export interface User {
    id: string;
    telegram_id: number;
    language: Language;
    tier: UserTier;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface Match {
    id: string;
    fixture_id: number;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    venue: string | null;
    kickoff_at: string;
    status: MatchStatus;
    league_id: number;
    season: number;
    last_polled_at: string | null;
}
export interface MatchSubscription {
    id: string;
    user_id: string;
    match_id: string;
    created_at: string;
}
export interface EventFingerprint {
    id: string;
    fingerprint: string;
    fixture_id: number;
    event_type: string;
    event_minute: number;
    created_at: string;
}
export interface CommentaryUpdate {
    id: string;
    match_id: string;
    fixture_id: number;
    language: Language;
    event_type: EventType;
    event_minute: number | null;
    content: string;
    word_count: number | null;
    is_summary: boolean;
    created_at: string;
}
export interface Sponsor {
    id: string;
    name: string;
    message: string;
    cta_url: string | null;
    active_from: string;
    active_until: string;
}
export interface Payment {
    id: string;
    user_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    created_at: string;
}
export interface ApiKey {
    id: string;
    key_hash: string;
    client_name: string;
    tier: string;
    rate_limit: number;
    is_active: boolean;
    last_used_at: string | null;
}
export interface MatchEventPayload {
    fixtureId: number;
    eventType: EventType;
    eventDetail: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    minute: number;
    venue: string;
    language: Language;
}
export interface CommentaryResult {
    text: string;
    language: Language;
    wordCount: number;
    isFallback: boolean;
}
//# sourceMappingURL=db.d.ts.map