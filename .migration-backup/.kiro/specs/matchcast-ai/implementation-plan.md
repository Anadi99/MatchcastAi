# Implementation Plan
# MatchCast AI — World Cup 2026

## Overview

14-day solo build. Each day has a clear deliverable. The plan is structured so the system is testable at each stage and revenue features (sponsorship, payments) come after the core loop is working.

---

## Project Structure

```
matchcast-ai/
├── apps/
│   ├── backend/                  # Node.js + Express
│   │   ├── src/
│   │   │   ├── bot/              # Telegram bot handler + commands
│   │   │   ├── commentary/       # Gemini commentary engine
│   │   │   ├── events/           # Event processor + fingerprinting
│   │   │   ├── poller/           # API-Football polling cron
│   │   │   ├── sponsors/         # Sponsor injector
│   │   │   ├── subscriptions/    # Razorpay webhook + tier management
│   │   │   ├── api/              # White-label REST API (/v1)
│   │   │   ├── db/               # Supabase client + query helpers
│   │   │   ├── types/            # Shared TypeScript types
│   │   │   └── index.ts          # Express app entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                      # Next.js 14 frontend
│       ├── app/
│       │   ├── page.tsx           # matchcast.in home
│       │   ├── api/
│       │   │   └── stream/[matchId]/route.ts  # SSE endpoint
│       │   └── components/
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   └── migrations/               # SQL migration files
│
└── railway.toml                  # Railway deployment config
```

---

## Day-by-Day Build Plan

### Days 1–2: Foundation

**Goal**: Telegram bot responds to commands; API-Football sandbox returns data; Supabase schema live.

Tasks:
- [ ] Initialise Node.js + TypeScript project, install dependencies
- [ ] Create Supabase project, run all migrations from `backend-schema.md`
- [ ] Register Telegram bot via BotFather, store token in `.env`
- [ ] Implement `/start` command with inline language keyboard
- [ ] Implement `Language_Manager`: insert/update user record in Supabase on language selection
- [ ] Implement `/help` command with full command list
- [ ] Connect to API-Football sandbox: fetch today's fixtures, log to console
- [ ] Set up Railway project, deploy basic Express health check endpoint (`GET /health`)

Deliverable: Bot responds to `/start`, stores user language in Supabase, fetches fixtures.

---

### Days 3–4: Commentary Engine

**Goal**: Given a match event, Gemini generates Hindi commentary and logs it.

Tasks:
- [ ] Install `@google/generative-ai` SDK, configure Gemini 1.5 Flash client
- [ ] Implement `Commentary_Engine`:
  - `generate(payload: MatchEventPayload, language: Language): Promise<CommentaryResult>`
  - Build canonical prompt from template
  - Apply language-specific tone directive
  - Validate output (≤60 words, non-empty)
  - Retry logic (1 retry, 2s delay) + fallback text
- [ ] Write unit tests for prompt building and output validation
- [ ] Test Hindi commentary generation with 5 sample events (goal, card, subst, VAR, pulse)
- [ ] Log generated commentary to Supabase `commentary_updates` table

Deliverable: Hindi commentary generated from a hardcoded test event payload.

---

### Days 5–6: Language System + User Storage

**Goal**: All 4 languages working; `/start` flow complete end-to-end; user data in Supabase.

Tasks:
- [ ] Add Tamil, Telugu, Marathi tone directives to Commentary_Engine
- [ ] Test each language with 3 event types; tune prompts until tone is correct
- [ ] Implement `/language` command (re-show language keyboard, update preference)
- [ ] Implement `/status` command (show language, tier, subscriptions)
- [ ] Implement `/matches` command (query Supabase `matches`, render formatted list)
- [ ] Implement `/subscribe {match_id}` and `/unsubscribe {match_id}` commands
- [ ] Implement `IF unrecognised command THEN send help message` handler
- [ ] End-to-end test: new user → /start → language → /matches → /subscribe

Deliverable: Complete Telegram onboarding flow; all 4 languages generating commentary.

---

### Days 7–8: Live Polling Loop + Deduplication

**Goal**: System polls a live match, detects events, generates commentary, sends to subscribers.

Tasks:
- [ ] Implement `Poller`:
  - `fetchDailyFixtures()` cron: `*/5 * * * *`, updates `matches` table
  - `pollLiveMatch(fixtureId)` cron: `* * * * *` per live match
  - Start/stop polling based on match status transitions
  - Rate limit handling: pause 30s on 429
- [ ] Implement `Event_Processor`:
  - Generate fingerprint: `{fixtureId}:{type}:{minute}:{team}:{player}`
  - Check + insert to `event_fingerprints` table
  - Dispatch new events to Commentary_Engine
- [ ] Implement `Pulse_Update` path: fires when no new events in last 60s
- [ ] Implement `Delivery_Service`: queries subscribers, sends Telegram messages
- [ ] Implement match lifecycle state machine (scheduled → live → finished)
- [ ] Implement full-time detection → `generateSummary()` → deliver to subscribers
- [ ] Test with a real live match (or API-Football sandbox fixture)

Deliverable: End-to-end live commentary loop working. Events → commentary → Telegram push.

---

### Days 9–10: Sponsor System + Web Frontend

**Goal**: Sponsors inject on every 4th update; matchcast.in shows live commentary.

Tasks:
- [ ] Implement `Sponsor_Injector`:
  - Per-user counter in memory
  - Active sponsor fetch from Supabase (refresh every 5 min)
  - Inject on every 4th update for free users
  - Log delivery to `sponsor_deliveries`
  - Suppress for premium users
- [ ] Seed test sponsor in Supabase; verify injection cadence
- [ ] Bootstrap Next.js 14 app in `apps/web/`
- [ ] Implement SSE endpoint: `GET /api/stream/{matchId}?lang={code}`
  - Streams new commentary_updates as they arrive
  - Initial response: last 20 updates
- [ ] Build `CommentaryFeed` component (auto-updates via SSE)
- [ ] Build `Scoreboard` component (sticky, real-time score)
- [ ] Build `MatchSelector` tabs
- [ ] Build `LanguageToggle` (switches SSE stream)
- [ ] Build `SponsorCard` component
- [ ] Mobile-first layout with Tailwind; dark theme
- [ ] Deploy Next.js to Railway; verify matchcast.in loads

Deliverable: matchcast.in shows live commentary feed with sponsor cards; Telegram push includes sponsor on 4th update.

---

### Days 11–12: Payments + Premium Tier

**Goal**: User pays ₹99, gets premium instantly via webhook.

Tasks:
- [ ] Install Razorpay Node SDK; configure credentials
- [ ] Implement `/premium` command: create Razorpay order, return hosted checkout link
- [ ] Implement `POST /webhook/razorpay`:
  - Verify HMAC-SHA256 signature
  - On `payment.captured`: update user tier to premium, set expires_at
  - Send confirmation via Bot
  - Insert payment record
- [ ] Implement subscription expiry cron (daily at 00:00 UTC)
- [ ] Implement pre-match report for premium users (30 min before kick-off)
- [ ] Verify sponsor suppression for premium users end-to-end
- [ ] Test payment flow with Razorpay test mode

Deliverable: Full payment flow working; premium tier activated within 60s of payment.

---

### Days 13–14: Beta, Polish, Launch Prep

**Goal**: System stable, tested with real WC 2026 schedule, ready for public launch.

Tasks:
- [ ] Run beta test: subscribe to 3–4 simultaneous live matches, verify no duplicates
- [ ] Audit Gemini prompt quality across all 4 languages with native speakers
- [ ] Implement `GET /health` endpoint with uptime and poller status
- [ ] Add structured logging (console JSON logs readable in Railway dashboard)
- [ ] Verify Lighthouse score ≥ 80 on matchcast.in mobile
- [ ] Set up Railway environment variables for production
- [ ] Implement White-Label API endpoints (`/v1/commentary`)
- [ ] Write basic API documentation (README section)
- [ ] Load test: simulate 1,000 concurrent Telegram message sends
- [ ] Configure Railway auto-deploy from `main` branch
- [ ] Seed production Supabase with WC 2026 group stage fixtures
- [ ] Announce on Twitter/football communities; share Telegram bot link

Deliverable: Production system live at matchcast.in and @MatchCastBot, ready for World Cup 2026.

---

## Dependency Installation Reference

### Backend (`apps/backend/`)
```bash
npm install express node-telegram-bot-api node-cron @google/generative-ai @supabase/supabase-js razorpay axios dotenv
npm install --save-dev typescript @types/express @types/node @types/node-telegram-bot-api @types/node-cron tsx
```

### Frontend (`apps/web/`)
```bash
npx create-next-app@latest web --typescript --tailwind --app --no-src-dir
cd web && npm install
```

---

## Critical Path

The following must be done in order — each unblocks the next:

1. Supabase schema → enables all data persistence
2. API-Football connection → enables fixture + event data
3. Commentary_Engine (Hindi) → proves the core loop
4. Live Polling + Event_Processor → makes it real-time
5. Bot delivery → gets commentary to users
6. All 4 languages → opens premium upsell
7. Sponsor injection → enables revenue before payments
8. Razorpay payments → activates subscription revenue

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| API-Football free tier (100 req/day) exhausted before WC | High | Upgrade to paid tier (₹1,500/month) before launch |
| Gemini language quality poor in Tamil/Telugu | Medium | Manual prompt tuning days 5–6; fallback to Hindi if quality unacceptable |
| Telegram rate limits (30 msg/sec per bot) | Medium | Queue messages with 34ms spacing; batch sends where possible |
| Razorpay webhook failures | Low | Idempotent webhook handler; manual upgrade command as fallback |
| Railway cold starts delaying restart recovery | Low | Set Railway to always-on (paid plan); implement 30s recovery logic |
