-- MatchCast AI — World Cup 2026
-- Initial Schema Migration

-- 2.1 users
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

-- 2.2 matches
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

-- 2.3 match_subscriptions
CREATE TABLE match_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX idx_match_subs_match_id ON match_subscriptions (match_id);
CREATE INDEX idx_match_subs_user_id ON match_subscriptions (user_id);

-- 2.4 event_fingerprints
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

-- 2.5 commentary_updates
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

-- 2.6 sponsors
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

-- 2.7 sponsor_deliveries
CREATE TABLE sponsor_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id  UUID NOT NULL REFERENCES sponsors(id),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    UUID REFERENCES matches(id),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsor_deliveries_sponsor_id ON sponsor_deliveries (sponsor_id);
CREATE INDEX idx_sponsor_deliveries_delivered_at ON sponsor_deliveries (delivered_at);

-- 2.8 payments
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

-- 2.9 api_keys
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

-- 3. Row Level Security Policies

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
