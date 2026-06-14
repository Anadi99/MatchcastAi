# Implementation Plan: MatchCast AI

## Overview

TypeScript monorepo with a Node.js + Express backend and Next.js 14 frontend. Tasks follow the 14-day build plan, starting from project scaffolding through to white-label API and production readiness. Each task builds directly on the previous one — no orphaned code.

## Tasks

- [x] 1. Project scaffolding and Supabase schema
  - [x] 1.1 Initialise monorepo structure
    - Create `apps/backend/` and `apps/web/` directories
    - Add root `package.json` with workspaces, `railway.toml`
    - Install backend dependencies: `express node-telegram-bot-api node-cron @google/generative-ai @supabase/supabase-js razorpay axios dotenv`
    - Install dev dependencies: `typescript @types/express @types/node @types/node-telegram-bot-api @types/node-cron tsx`
    - Configure `tsconfig.json` with strict mode for the backend
    - Create `src/types/db.ts` with all TypeScript types from `backend-schema.md` (Language, UserTier, MatchStatus, EventType, User, Match, CommentaryUpdate, etc.)
    - Create `.env.example` with all required environment variable keys from `trd.md` Section 5
    - _Requirements: 10.1, 10.2_

  - [x] 1.2 Create Supabase migration files
    - Create `supabase/migrations/001_initial_schema.sql` containing all DDL from `backend-schema.md`: tables `users`, `matches`, `match_subscriptions`, `event_fingerprints`, `commentary_updates`, `sponsors`, `sponsor_deliveries`, `payments`, `api_keys`
    - Include all indexes and CHECK constraints
    - Include RLS `ENABLE` statements and the `users_self_read` policy
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 1.3 Create Supabase client and query helpers
    - Create `src/db/client.ts` that initialises the Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
    - Create `src/db/users.ts` with functions: `upsertUser(telegramId, language)`, `getUserByTelegramId(telegramId)`, `upgradeUserToPremium(telegramId, expiresAt)`, `downgradeExpiredPremiumUsers()`
    - Create `src/db/matches.ts` with functions: `upsertMatch(fixture)`, `getLiveMatches()`, `getTodayMatches()`, `updateMatchStatus(fixtureId, status)`
    - Create `src/db/subscriptions.ts` with functions: `addSubscription(userId, matchId)`, `removeSubscription(userId, matchId)`, `getSubscribersForMatch(fixtureId)`
    - Create `src/db/commentary.ts` with functions: `insertCommentaryUpdate(update)`, `getCommentaryForMatch(fixtureId, language, limit)`
    - Create `src/db/fingerprints.ts` with functions: `checkFingerprint(fingerprint)`, `insertFingerprint(data)`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 2. Express app entry point and health check
  - [x] 2.1 Create Express app entry point
    - Create `src/index.ts` as the Express app entry point
    - Mount `GET /health` endpoint returning `{ status: "ok", uptime: process.uptime() }`
    - Load environment variables with `dotenv`
    - Export the Express `app` and a `startServer()` function
    - _Requirements: 10.6_

- [x] 3. Telegram bot foundation and onboarding commands
  - [x] 3.1 Initialise bot handler and `/start` command
    - Create `src/bot/index.ts` that initialises `node-telegram-bot-api` in polling mode using `TELEGRAM_BOT_TOKEN`
    - Export `sendMessage(telegramId: number, text: string): Promise<void>` used by the Delivery_Service
    - Implement `/start` handler: present an inline keyboard with buttons Hindi, Tamil, Telugu, Marathi
    - Implement the callback query handler for language selection: call `upsertUser`, then reply "Language set! Use /matches to see live games"
    - _Requirements: 1.1, 1.2, 7.1_

  - [x] 3.2 Implement remaining bot commands
    - Implement `/language` handler: re-display the language selection keyboard
    - Implement `/help` handler: reply with the full list of supported commands and their descriptions
    - Implement `/status` handler: query `getUserByTelegramId` and `getSubscriptionsForUser`, format and reply with language, tier, and active subscriptions
    - Implement `/matches` handler: call `getTodayMatches()`, format as a numbered list with match IDs, reply to user
    - Implement `/subscribe {match_id}` handler: call `addSubscription`, reply with confirmation
    - Implement `/unsubscribe {match_id}` handler: call `removeSubscription`, reply with confirmation
    - Implement fallback handler for unrecognised commands: reply with helpful message listing available commands
    - Implement guard: if user has not completed language selection, prompt them before any other command proceeds
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 4. API-Football integration and Poller
  - [x] 4.1 Implement API-Football client
    - Create `src/poller/apiFootball.ts` with functions `fetchDailyFixtures(date: string)` and `fetchMatchEvents(fixtureId: number)` and `fetchMatchStatistics(fixtureId: number)`
    - Use `axios` with `X-RapidAPI-Key` header set from `API_FOOTBALL_KEY`
    - Implement 429 detection: throw a `RateLimitError` when the response status is 429
    - _Requirements: 3.1, 9.1, 9.2, 9.6_

  - [x] 4.2 Implement Poller cron jobs
    - Create `src/poller/index.ts` with two cron jobs:
      1. `fetchDailyFixtures` on schedule `*/5 * * * *`: calls `fetchDailyFixtures`, upserts results to `matches` table via `upsertMatch`
      2. `pollLiveMatches` on schedule `* * * * *`: for each match in `getLiveMatches()`, calls `fetchMatchEvents` and emits an `eventsReady` event on a local `EventEmitter`
    - On `RateLimitError`, pause the affected match poll for 30 seconds then resume
    - On backend restart, call `getLiveMatches()` and resume polling for each live match immediately
    - Export `startPoller()` and `stopPollingForMatch(fixtureId: number)`
    - _Requirements: 3.1, 3.5, 3.6, 9.1, 9.2, 9.6, 10.6_

- [x] 5. Event Processor and deduplication
  - [x] 5.1 Implement Event_Processor
    - Create `src/events/processor.ts`
    - Subscribe to the `eventsReady` event from the Poller
    - For each raw API-Football event, generate a fingerprint string: `{fixtureId}:{type}:{minute}:{team}:{player}`
    - Call `checkFingerprint(fingerprint)`; if it already exists, discard the event silently
    - For new events, call `insertFingerprint` then emit a `newEvent` event with a `MatchEventPayload`
    - For pulse ticks (no new events in last 60s), emit a `pulseRequired` event with current match statistics
    - Process events in the order returned by API-Football
    - _Requirements: 2.8, 9.3, 9.4, 9.5_

- [x] 6. Commentary Engine (Hindi first)
  - [x] 6.1 Implement Commentary_Engine for Hindi
    - Create `src/commentary/engine.ts`
    - Initialise the `@google/generative-ai` SDK with `GEMINI_API_KEY`, targeting `gemini-1.5-flash`
    - Implement `generate(payload: MatchEventPayload, language: Language): Promise<CommentaryResult>`
    - Build the canonical prompt from the template in `trd.md` Section 3.3
    - Apply the Hindi tone directive: "dramatic, high-emotion, Bollywood-style"
    - Validate the response: reject if empty or over 60 words; on validation failure treat as API error
    - Implement retry logic: on Gemini error, wait 2 seconds and retry once; on second failure, return fallback text `"{eventType}: {team} — {player}, {minute}'"`
    - Implement `generatePulse(payload, language)` with a shorter prompt for possession/tempo observation (max 60 words)
    - Implement `generateSummary(matchData, language)` with a 5-line match summary prompt; 30-second timeout
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.6_

  - [ ]* 6.2 Write unit tests for Commentary_Engine
    - Test prompt construction for each event type (goal, card, subst, VAR, pulse)
    - Test 60-word limit enforcement
    - Test retry logic: mock Gemini to fail once, verify retry occurs and succeeds
    - Test fallback text format when both attempts fail
    - _Requirements: 2.4, 2.7_

- [x] 7. Language system — all four languages
  - [x] 7.1 Add remaining language tone directives
    - In `src/commentary/engine.ts`, add tone directive mappings for Tamil ("poetic, lyrical, classical Tamil expression"), Telugu ("energetic, exclamatory, Telugu film style"), and Marathi ("conversational, local Marathi warmth")
    - Apply the correct directive based on the `language` parameter in `generate()`, `generatePulse()`, and `generateSummary()`
    - _Requirements: 2.3, 3.3, 4.3, 6.1, 6.2_

- [x] 8. Delivery Service and end-to-end live loop
  - [x] 8.1 Implement Delivery_Service
    - Create `src/events/delivery.ts`
    - Subscribe to `newEvent` and `pulseRequired` from the Event_Processor
    - On `newEvent`: call `getSubscribersForMatch(fixtureId)`, then for each subscriber call `Commentary_Engine.generate(payload, subscriber.language)`
    - On `pulseRequired`: call `Commentary_Engine.generatePulse(payload, subscriber.language)` for each subscriber
    - For each generated text, pass to `Sponsor_Injector.maybeInject(user, text)` before sending
    - Call `Bot.sendMessage(subscriber.telegram_id, finalText)`
    - Call `insertCommentaryUpdate` to persist each generated commentary to Supabase
    - Implement match lifecycle: on full-time event, call `Commentary_Engine.generateSummary`, deliver to all subscribers, then call `stopPollingForMatch` and `updateMatchStatus(fixtureId, 'finished')`
    - _Requirements: 2.1, 3.2, 4.1, 4.4, 4.5, 9.5, 10.4_

- [x] 9. Checkpoint — verify end-to-end live loop
  - Ensure the Poller → Event_Processor → Commentary_Engine → Delivery_Service → Bot chain works end-to-end with a test fixture
  - Ensure fingerprint deduplication prevents duplicate messages
  - Ensure all tests pass; ask the user if questions arise.

- [x] 10. Sponsor Injector
  - [x] 10.1 Implement Sponsor_Injector
    - Create `src/sponsors/injector.ts`
    - Maintain an in-memory `Map<telegramId, counter>` tracking update counts per user per match session
    - On startup and every 5 minutes (via a cron at `*/5 * * * *`), fetch the active sponsor from Supabase using the active sponsor query from `backend-schema.md` Section 4
    - Implement `maybeInject(user: User, text: string): Promise<string>`:
      - If `user.tier === 'premium'`, return `text` unchanged
      - Increment the counter for the user; if `counter % 4 === 0`, append the sponsor message separated by a visible delimiter (e.g., `\n\n---\n`)
      - If no active sponsor, return `text` unchanged
      - If injected, call `insertSponsorDelivery(sponsorId, userId, matchId)` to log to `sponsor_deliveries`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 10.2 Create sponsor_deliveries DB helper
    - Add `insertSponsorDelivery(sponsorId, userId, matchId)` to a new `src/db/sponsors.ts` file
    - Add `getActiveSponsor()` query function
    - _Requirements: 5.2, 5.6_

- [x] 11. Next.js web frontend
  - [x] 11.1 Bootstrap Next.js app and SSE endpoint
    - Scaffold `apps/web/` using `create-next-app` with TypeScript, Tailwind, App Router
    - Create `app/api/stream/[matchId]/route.ts` as a Next.js Route Handler using `Response` with a `ReadableStream`
    - On connection, fetch last 20 `commentary_updates` for the match and language from Supabase, stream them as SSE `data:` events
    - Subscribe to new `commentary_updates` inserts via Supabase Realtime and stream each new row as an SSE event matching the `SSECommentaryEvent` schema in `backend-schema.md` Section 6
    - Accept `lang` query param (default `hi`); re-query on language change
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.2 Build CommentaryFeed and Scoreboard components
    - Create `app/components/Scoreboard.tsx`: sticky header showing home team, score, away team, match minute, and match status; updates via SSE `score_update` events
    - Create `app/components/CommentaryCard.tsx`: renders a single commentary update card with event type icon, minute, and commentary text; sponsor updates use a visually distinct style
    - Create `app/components/CommentaryFeed.tsx`: opens an `EventSource`, prepends new `CommentaryCard`s as SSE events arrive; initialises with the last 20 updates
    - _Requirements: 8.1, 8.4_

  - [x] 11.3 Build MatchSelector, LanguageToggle, and SponsorCard components
    - Create `app/components/MatchSelector.tsx`: tab bar showing all live matches; clicking a tab switches the active match ID, causing CommentaryFeed to reconnect with the new match ID
    - Create `app/components/LanguageToggle.tsx`: buttons for hi/ta/te/mr; on click, closes existing EventSource and opens a new one with the selected language
    - Create `app/components/SponsorCard.tsx`: rendered inside CommentaryFeed for events where `eventType === 'sponsor'`; visually distinct with brand styling
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 11.4 Assemble home page with mobile-first layout
    - Assemble `app/page.tsx` composing Scoreboard, MatchSelector, LanguageToggle, and CommentaryFeed
    - Apply dark theme and mobile-first Tailwind layout; ensure correct rendering at viewport width ≥ 320px
    - Ensure server-side initial data fetch so the page renders with content before client JavaScript runs
    - _Requirements: 8.2, 8.6, 8.7_

- [x] 12. Razorpay payments and premium tier
  - [x] 12.1 Implement `/premium` command and order creation
    - In `src/subscriptions/index.ts`, implement `createOrder(telegramId: number)`: calls the Razorpay Node SDK to create an order for amount `9900` (₹99 in paise), stores `telegram_id` in order notes
    - In the bot handler, implement `/premium` command: call `createOrder`, then reply with price card text and the Razorpay hosted checkout URL
    - _Requirements: 6.3, 12.1_

  - [x] 12.2 Implement Razorpay webhook handler
    - In `src/subscriptions/index.ts`, create a `POST /webhook/razorpay` Express route
    - Verify the HMAC-SHA256 signature from the `X-Razorpay-Signature` header using `RAZORPAY_WEBHOOK_SECRET`; return 400 if invalid and log the failure
    - On verified `payment.captured` event: extract `telegram_id` from `payment.notes`, call `upgradeUserToPremium(telegramId, expiresAt)` where `expiresAt = now() + 30 days`, insert a payment record via a new `insertPayment()` db helper, call `Bot.sendMessage(telegramId, "⭐ Premium activated!")`
    - On `payment.failed` or `payment.refunded`: ensure tier is not activated or is deactivated; log event
    - Mount the webhook route on the Express app in `src/index.ts`
    - _Requirements: 6.4, 12.2, 12.3, 12.4, 12.5_

  - [x] 12.3 Implement subscription expiry cron and pre-match report
    - Add a daily cron at `0 0 * * *` in `src/subscriptions/index.ts` that calls `downgradeExpiredPremiumUsers()` and notifies each downgraded user via `Bot.sendMessage`
    - Implement pre-match report for premium users: 30 minutes before each match's `kickoff_at`, query premium subscribers for that match, call `Commentary_Engine.generateSummary` with a pre-match payload, and deliver via `Bot.sendMessage`
    - _Requirements: 6.5, 6.6, 12.6_

  - [x] 12.4 Create payments DB helper
    - Add `insertPayment(paymentData)` to `src/db/payments.ts`
    - _Requirements: 12.4_

- [x] 13. Checkpoint — verify payments and premium tier
  - Test the Razorpay test-mode payment flow end-to-end: order creation → webhook → tier upgrade → bot confirmation
  - Verify sponsor messages are suppressed for premium users
  - Verify pre-match reports deliver to premium users only
  - Ensure all tests pass; ask the user if questions arise.

- [x] 14. White-Label API
  - [x] 14.1 Implement API key validation middleware
    - Create `src/api/auth.ts`: Express middleware that extracts the Bearer token from the `Authorization` header, hashes it with SHA-256, and looks it up in the `api_keys` table via a `getApiKey(keyHash)` db helper in `src/db/apiKeys.ts`
    - Return 401 with `{ error: "Unauthorized" }` if key is missing or not found in Supabase
    - Attach the resolved `ApiKey` object to `req.apiKey` for downstream use
    - _Requirements: 11.2, 11.3_

  - [x] 14.2 Implement rate limiting and commentary endpoint
    - Install and configure `express-rate-limit`; apply a limiter of 60 requests per minute keyed by `req.apiKey.id`; return 429 with `Retry-After` header on breach
    - Create `src/api/routes.ts` with `GET /v1/commentary/:matchId`:
      - Parse `lang` (default `hi`) and `limit` (default `10`, max `50`) query params
      - Call `getCommentaryForMatch(matchId, language, limit)` from the DB helper
      - Fetch match details from `matches` table
      - Return JSON matching the `WhiteLabelResponse` schema from `backend-schema.md` Section 6
    - Mount `src/api/routes.ts` under `/v1` on the Express app in `src/index.ts`
    - _Requirements: 11.1, 11.4, 11.5, 11.6_

  - [x] 14.3 Create api_keys DB helper
    - Add `getApiKey(keyHash: string)` to `src/db/apiKeys.ts`
    - _Requirements: 11.2_

- [x] 15. Structured logging and health endpoint
  - [x] 15.1 Add structured JSON logging and enhanced health check
    - Add console JSON logging throughout: Poller cycles, Event_Processor fingerprint checks, Commentary_Engine calls (including latency), Sponsor_Injector injections, webhook events
    - Enhance `GET /health` to include `{ status, uptime, liveMatchCount, pollerActive }` so Railway dashboards show poller state
    - _Requirements: 9.6, 10.6_

- [x] 16. Final checkpoint — full system integration
  - Wire all modules in `src/index.ts`: start Express server, initialise bot, start Poller, start Event_Processor, start Sponsor_Injector refresh cron, start subscription expiry cron
  - Verify restart recovery: stop and restart the server, confirm live matches resume polling within 30 seconds
  - Ensure all tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All code is TypeScript strict mode; never use `any`
- All secrets via environment variables — never hardcoded
- Razorpay webhook route must use `express.raw()` body parser (not JSON) for signature verification
- API-Football free tier is 100 req/day — upgrade to paid tier before live WC polling
- Telegram rate limit is 30 msg/sec; add 34ms spacing between bulk sends in Delivery_Service
