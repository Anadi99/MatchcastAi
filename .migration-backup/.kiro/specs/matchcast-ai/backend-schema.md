# Backend Schema Document
# MatchCast AI — World Cup 2026

## 1. Database: Supabase (PostgreSQL)

All tables use UUID primary keys, `created_at` timestamps (default `now()`), and Row Level Security (RLS) enabled. The backend accesses Supabase via the service role key (bypasses RLS for server-side operations).

---

## 2. Table Definitions

### 2.1 `users`

Stores every Telegram user who has interacted with the bot.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id     BIGINT UNIQUE NOT NULL,
  language        TEXT NOT NULL DEFAULT 'hi'
                    CHECK (language IN ('hi', 'ta', 'te', 'mr')),
  tier            TEXT NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free', 'premium')),
  expires_at      TIMESTAMPTZ,          -- NULL for free users
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_telegram_id ON users (telegram_id);
```

---

### 2.2 `matches`

Cached fixture data from API-Football. Refreshed every 5 minutes.

```sql
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      INTEGER UNIQUE NOT NULL,   -- API-Football fixture ID
  home_team       TEXT NOT NULL,
  away_team       TEXT NOT NULL,
  home_score      INTEGER NOT NULL DEFAULT 0,
  away_score      INTEGER NOT NULL DEFAULT 0,
  venue           TEXT,
  kickoff_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'live', 'finished')),
  league_id       INTEGER NOT NULL,
  season          INTEGER NOT NULL,
  last_polled_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_fixture_id ON matches (fixture_id);
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_kickoff_at ON matches (kickoff_at);
```

---

### 2.3 `match_subscriptions`

Maps users to the matches they have subscribed to receive commentary for.

```sql
CREATE TABLE match_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX idx_match_subs_match_id ON match_subscriptions (match_id);
CREATE INDEX idx_match_subs_user_id ON match_subscriptions (user_id);
```

---

### 2.4 `event_fingerprints`

Deduplication store. One row per processed match event.

```sql
CREATE TABLE event_fingerprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  -- Format: {fixture_id}:{event_type}:{minute}:{team}:{player}
  fixture_id  INTEGER NOT NULL,
  event_type  TEXT NOT NULL,
  event_minute INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fingerprints_fixture_id ON event_fingerprints (fixture_id);
```

---

### 2.5 `commentary_updates`

All generated commentary, persisted for web feed, API, and replay.

```sql
CREATE TABLE commentary_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  fixture_id    INTEGER NOT NULL,
  language      TEXT NOT NULL CHECK (language IN ('hi', 'ta', 'te', 'mr')),
  event_type    TEXT NOT NULL,
  -- 'goal' | 'card' | 'subst' | 'var' | 'pulse' | 'summary' | 'pre_match'
  event_minute  INTEGER,
  content       TEXT NOT NULL,
  word_count    INTEGER,
  is_summary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commentary_match_lang ON commentary_updates (match_id, language);
CREATE INDEX idx_commentary_fixture_id ON commentary_updates (fixture_id);
CREATE INDEX idx_commentary_created_at ON commentary_updates (created_at DESC);
```

---

### 2.6 `sponsors`

Sponsor records with active time windows.

```sql
CREATE TABLE sponsors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  message       TEXT NOT NULL,             -- The text to inject
  cta_url       TEXT,                      -- Optional call-to-action URL
  active_from   TIMESTAMPTZ NOT NULL,
  active_until  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsors_active ON sponsors (active_from, active_until);
```

Query for active sponsor:
```sql
SELECT * FROM sponsors
WHERE active_from <= now() AND active_until >= now()
ORDER BY created_at DESC
LIMIT 1;
```

---

### 2.7 `sponsor_deliveries`

Audit log for sponsor message delivery — used for sponsor reporting.

```sql
CREATE TABLE sponsor_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id  UUID NOT NULL REFERENCES sponsors(id),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    UUID REFERENCES matches(id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsor_deliveries_sponsor_id ON sponsor_deliveries (sponsor_id);
CREATE INDEX idx_sponsor_deliveries_delivered_at ON sponsor_deliveries (delivered_at);
```

---

### 2.8 `payments`

Razorpay payment records.

```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT,
  amount          INTEGER NOT NULL,    -- Amount in paise (9900 = ₹99)
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON payments (user_id);
CREATE INDEX idx_payments_razorpay_order_id ON payments (razorpay_order_id);
```

---

### 2.9 `api_keys`

White-label API key management.

```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash    TEXT UNIQUE NOT NULL,    -- SHA-256 hash of the raw key
  client_name TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'standard'
                CHECK (tier IN ('standard', 'enterprise')),
  rate_limit  INTEGER NOT NULL DEFAULT 60,  -- requests per minute
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```

---

## 3. Row Level Security Policies

```sql
-- Users can only read their own row via client-side access (not used server-side)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self_read" ON users
  FOR SELECT USING (auth.uid()::text = telegram_id::text);

-- All other tables: server-side only (service role bypasses RLS)
ALTER TABLE match_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE commentary_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
```

---

## 4. Key Queries

### Get all subscribers for a live match
```sql
SELECT u.telegram_id, u.language, u.tier
FROM match_subscriptions ms
JOIN users u ON u.id = ms.user_id
JOIN matches m ON m.id = ms.match_id
WHERE m.fixture_id = $1
  AND m.status = 'live';
```

### Check event deduplication
```sql
SELECT 1 FROM event_fingerprints
WHERE fingerprint = $1
LIMIT 1;
```

### Get latest commentary for web feed
```sql
SELECT id, event_type, event_minute, content, created_at
FROM commentary_updates
WHERE fixture_id = $1
  AND language = $2
ORDER BY created_at DESC
LIMIT 20;
```

### Get active sponsor
```sql
SELECT id, name, message, cta_url
FROM sponsors
WHERE active_from <= now()
  AND active_until >= now()
ORDER BY created_at DESC
LIMIT 1;
```

### Expire premium subscriptions
```sql
UPDATE users
SET tier = 'free', updated_at = now()
WHERE tier = 'premium'
  AND expires_at < now();
```

---

## 5. TypeScript Types

```typescript
// src/types/db.ts

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

// Commentary Engine types
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
```

---

## 6. API Response Schemas

### White-Label API Response

```typescript
// GET /v1/commentary/{matchId}?lang=hi&limit=10

interface WhiteLabelResponse {
  matchId: string;
  language: Language;
  match: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    status: MatchStatus;
    minute: number | null;
  };
  updates: Array<{
    id: string;
    text: string;
    eventType: EventType;
    minute: number | null;
    timestamp: string;  // ISO 8601
  }>;
  total: number;
}
```

### SSE Event Format (Web Feed)

```typescript
// data: {JSON}

interface SSECommentaryEvent {
  type: 'commentary' | 'score_update' | 'match_end';
  update: {
    id: string;
    text: string;
    eventType: EventType;
    minute: number | null;
    language: Language;
    timestamp: string;
  };
  score?: {
    home: number;
    away: number;
  };
}
```
