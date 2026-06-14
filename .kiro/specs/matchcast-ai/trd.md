# Technical Requirements Document (TRD)
# MatchCast AI — World Cup 2026

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Services                         │
│  API-Football    Google Gemini 1.5 Flash    Razorpay    Telegram │
└────────┬─────────────────┬──────────────────┬──────────┬────────┘
         │                 │                  │          │
┌────────▼─────────────────▼──────────────────▼──────────▼────────┐
│                    Node.js + Express Backend                      │
│                                                                   │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │   Poller    │  │ Commentary Engine│  │   Bot Handler     │   │
│  │ (node-cron) │  │  (Gemini API)    │  │ (node-tg-bot-api) │   │
│  └──────┬──────┘  └────────┬─────────┘  └─────────┬─────────┘   │
│         │                  │                       │              │
│  ┌──────▼──────────────────▼───────────────────────▼──────────┐  │
│  │              Event Processor + Sponsor Injector             │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                    Supabase (PostgreSQL)                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────┐
│   Next.js Frontend       │
│   matchcast.in           │
│   (Tailwind CSS)         │
└──────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Bot runtime | Node.js | v20 LTS |
| Web framework | Express.js | v4 |
| Telegram bot | node-telegram-bot-api | latest |
| Scheduler | node-cron | v3 |
| AI commentary | Google Gemini 1.5 Flash | via @google/generative-ai SDK |
| Live football data | API-Football (apifootball.com) | Free tier |
| Database | Supabase (PostgreSQL) | via supabase-js v2 |
| Payments | Razorpay | Node SDK |
| Web frontend | Next.js 14 | App Router |
| CSS | Tailwind CSS | v3 |
| Hosting | Railway.app | Node.js service + static Next.js |
| Language | TypeScript | Strict mode across all services |

---

## 3. Module Specifications

### 3.1 Poller (`src/poller/`)

- Runs on node-cron schedules:
  - Every 5 minutes during non-match hours to fetch day's fixtures
  - Every 60 seconds while any subscribed match is live
- Fetches from API-Football endpoints:
  - `GET /fixtures?date={today}` — daily fixture list
  - `GET /fixtures/events?fixture={id}` — live events per match
- Emits `newEvent` and `pulseRequired` events to Event_Processor
- Tracks polling state per match in memory (backed by Supabase on restart)
- Respects API-Football rate limits: backs off 30s on 429 responses

### 3.2 Event Processor (`src/events/`)

- Receives raw API-Football event objects
- Generates fingerprint: `{fixtureId}:{type}:{minute}:{team}:{player}`
- Checks fingerprint against `event_fingerprints` table in Supabase
- Discards duplicates; persists new fingerprints before dispatching
- Dispatches to Commentary_Engine with structured `MatchEventPayload`
- Handles event types: `Goal`, `Card`, `Subst`, `Var`

### 3.3 Commentary Engine (`src/commentary/`)

- Builds Gemini prompt from `MatchEventPayload` using the canonical prompt template
- Calls Gemini 1.5 Flash via `@google/generative-ai` SDK
- Maps language code to tone directive:
  - `hi`: "dramatic, high-emotion, Bollywood-style"
  - `ta`: "poetic, lyrical, classical Tamil expression"
  - `te`: "energetic, exclamatory, Telugu film style"
  - `mr`: "conversational, local Marathi warmth"
- Applies output validation: max 60 words, non-empty, language-correct (basic script check)
- On Gemini error: retries once after 2s; falls back to plain event description
- Returns `CommentaryResult { text: string; language: string; wordCount: number }`

#### Canonical Prompt Template
```
You are a passionate Indian football commentator speaking in {language}. 
A match event just occurred: {event_type} — {event_detail}. 
Current score: {home_team} {home_score} – {away_score} {away_team}. 
Minute: {minute}. Venue: {venue}. 
Write a 2–3 sentence live commentary update in {language}. 
Rules: Sound like a real TV commentator, emotional and vivid. 
Use local expressions and cricket-style drama. 
Never use English unless it's a player or team name. 
End with a short reaction line. Max 60 words.
```

### 3.4 Bot Handler (`src/bot/`)

- Initialises node-telegram-bot-api in polling mode
- Command routing:
  - `/start` → language selection inline keyboard
  - `/language` → re-show language selection
  - `/matches` → list today's + live WC fixtures
  - `/subscribe {id}` → add subscription record
  - `/unsubscribe {id}` → remove subscription record
  - `/status` → show user profile
  - `/premium` → show Razorpay link
  - `/help` → command list
- `sendUpdate(userId, text)` — used by Delivery_Service to push commentary
- All bot commands respond within 3s; async operations are non-blocking

### 3.5 Sponsor Injector (`src/sponsors/`)

- Maintains an in-memory counter per User per match session
- Every 4th `sendUpdate` call for a Free_User appends active Sponsor_Message
- Fetches active sponsor from Supabase at startup and on 5-minute refresh
- Suppresses injection for Premium_Users
- Logs each injection to `sponsor_deliveries` table

### 3.6 Subscription Manager (`src/subscriptions/`)

- Exposes `/webhook/razorpay` POST endpoint
- Verifies HMAC-SHA256 signature using `RAZORPAY_WEBHOOK_SECRET`
- On verified `payment.captured`: upserts user tier to `premium`, sets `expires_at = now() + 30 days`
- Scheduled cron (daily at 00:00 UTC): downgrades expired premium users to `free`
- Notifies user via Bot on upgrade and expiry

### 3.7 White-Label API (`src/api/`)

- Routes under `/v1/commentary`
- `GET /v1/commentary/{matchId}?lang={code}&limit={n}` — returns latest commentary
- API key extracted from `Authorization: Bearer {key}` header
- Key validated against `api_keys` table in Supabase
- Rate limiting: express-rate-limit, 60 req/min per key, returns 429 + `Retry-After`
- Response schema: `{ matchId, language, updates: [{ id, text, eventType, minute, timestamp }] }`

---

## 4. Database Schema (Supabase / PostgreSQL)

See `backend-schema.md` for full DDL. Summary of tables:

| Table | Purpose |
|---|---|
| `users` | Telegram users, language, tier, subscription expiry |
| `match_subscriptions` | User ↔ match subscription mapping |
| `event_fingerprints` | Deduplication store for processed events |
| `commentary_updates` | Persisted commentary output per match/language |
| `sponsors` | Sponsor records with active window dates |
| `sponsor_deliveries` | Log of every sponsor message delivery |
| `payments` | Razorpay payment records |
| `api_keys` | White-label API keys |
| `matches` | Cached fixture data from API-Football |

---

## 5. Environment Variables

```
# Telegram
TELEGRAM_BOT_TOKEN=

# Google AI
GEMINI_API_KEY=

# API-Football
API_FOOTBALL_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# App
NODE_ENV=production
PORT=3000
BASE_URL=https://api.matchcast.in
```

---

## 6. API-Football Integration

- Base URL: `https://v3.football.api-sports.io`
- Auth: `X-RapidAPI-Key` header
- Key endpoints used:
  - `GET /fixtures?date={YYYY-MM-DD}&league=1&season=2026` (World Cup = league 1)
  - `GET /fixtures/events?fixture={id}` — returns all events for a fixture
  - `GET /fixtures/statistics?fixture={id}` — used for pulse updates (possession %)
- Free tier: 100 requests/day — polling strategy must batch efficiently
- During WC: ~8 simultaneous matches maximum → one fixture/events call per match per minute = 480 calls/day during peak. Paid tier (₹1,500/month) required for live WC.

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Event-to-push latency | ≤ 10 seconds |
| Bot command response time | ≤ 3 seconds |
| System uptime (WC window) | ≥ 99.5% |
| Gemini retry on failure | 1 retry, 2s delay |
| API-Football backoff on 429 | 30s pause |
| Message delivery success rate | ≥ 99% |
| Database connection pooling | Supabase default pool (10 connections) |
| Concurrent users supported | ≥ 10,000 Telegram subscribers |

---

## 8. Security Requirements

- All secrets in environment variables, never in code
- Razorpay webhook signature verified before processing
- API keys hashed (SHA-256) before storage in Supabase
- Supabase Row Level Security enabled on all tables
- HTTPS enforced on all endpoints (Railway handles TLS)
- Rate limiting on all public endpoints
- Input sanitisation on all user-provided strings before DB write

---

## 9. Deployment

- Backend: Node.js service on Railway, auto-deploy from `main` branch
- Frontend: Next.js on Railway (or Vercel for free tier)
- Domain: matchcast.in → Railway/Vercel via CNAME
- Health check endpoint: `GET /health` returns `{ status: "ok", uptime: number }`
