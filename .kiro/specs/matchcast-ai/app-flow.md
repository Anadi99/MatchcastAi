# App Flow Document
# MatchCast AI — World Cup 2026

## 1. High-Level System Flow

```
API-Football (every 60s)
        │
        ▼
    Poller
        │
        ├─── No new events ──────► Pulse_Update (if 60s elapsed)
        │                                │
        └─── New Match_Event ──────────► Event_Processor
                                              │
                                    fingerprint check
                                              │
                                    ┌─────────┴─────────┐
                                  NEW                DUPLICATE
                                    │                    │
                             Commentary_Engine       discard
                                    │
                               Gemini 1.5 Flash
                                    │
                             CommentaryResult
                                    │
                             Sponsor_Injector
                                    │ (every 4th update for free users)
                                    │
                             Delivery_Service
                                    │
                    ┌───────────────┴─────────────────┐
                    │                                 │
               Telegram Bot                      Web Feed (SSE)
               (per subscriber)              (matchcast.in stream)
```

---

## 2. User Flows

### 2.1 New User Onboarding

```
User opens Telegram, finds @MatchCastBot
         │
         ▼
Sends /start
         │
         ▼
Bot → Language selection keyboard
  [Hindi] [Tamil] [Telugu] [Marathi]
         │
User taps language
         │
         ▼
Language_Manager
  └─ INSERT user record in Supabase (telegram_id, language, tier=free)
         │
         ▼
Bot → "Language set! Use /matches to see live games"
         │
         ▼
User sends /matches
         │
         ▼
Bot queries Supabase matches cache
  └─ Returns list with inline [Subscribe] buttons
         │
User taps Subscribe for Brazil vs Argentina
         │
         ▼
INSERT match_subscription (user_id, match_id)
         │
         ▼
Bot → "✅ Subscribed! You'll get live commentary for Brazil vs Argentina"
         │
         ▼
[Commentary updates begin flowing as match events occur]
```

### 2.2 Live Commentary Delivery

```
Poller fetches API-Football /fixtures/events?fixture=1234
         │
         ▼
Event_Processor receives event list
         │
         ▼
For each event:
  └─ Generate fingerprint
  └─ Check event_fingerprints table
       │
       ├─ EXISTS → skip
       │
       └─ NEW →
           │
           INSERT fingerprint to Supabase
           │
           Query match_subscriptions for match_id=1234
           │
           For each subscribed user:
             │
             Fetch user.language from Supabase
             │
             Build MatchEventPayload { type, detail, score, minute, venue }
             │
             Commentary_Engine.generate(payload, language)
               └─ Build Gemini prompt
               └─ Call Gemini 1.5 Flash API
               └─ Validate response (≤60 words, non-empty)
               └─ On error → retry once → fallback to plain text
             │
             Sponsor_Injector.maybe_inject(user, commentaryText)
               └─ If user.tier == 'free' AND update_counter % 4 == 0:
                   └─ Append sponsor message
                   └─ Log to sponsor_deliveries
             │
             Bot.sendMessage(user.telegram_id, finalText)
             │
             INSERT commentary_update to Supabase
             │
             Emit SSE event to Web_Feed for matching language stream
```

### 2.3 60-Second Pulse Update

```
Poller tick (60s interval, match is live)
         │
No new Match_Events since last tick
         │
         ▼
Fetch match statistics (possession %) from API-Football
         │
         ▼
Build PulsePayload { possession_home, possession_away, minute, score, teams }
         │
         ▼
Commentary_Engine.generatePulse(payload, language)
  └─ Shorter prompt: situation summary, tempo, tactical observation
         │
         ▼
Sponsor_Injector.maybe_inject(user, pulseText)
         │
         ▼
Bot.sendMessage(user.telegram_id, finalText)
         │
         ▼
Emit SSE event to Web_Feed
```

### 2.4 Full-Time Flow

```
Event_Processor detects event.type == 'Match End'
         │
         ▼
Commentary_Engine.generateSummary(matchData)
  └─ Fetches all events + stats for the match
  └─ Builds 5-line summary prompt
  └─ Calls Gemini (with 30s timeout)
         │
         ▼
Bot sends summary to all match subscribers
  └─ Includes shareable plain-text version
         │
         ▼
Poller.stopPolling(matchId)
         │
         ▼
UPDATE matches SET status='finished' in Supabase
```

### 2.5 Premium Upgrade Flow

```
User sends /premium
         │
         ▼
Bot shows price card + Razorpay link
  (link = Razorpay hosted checkout, pre-filled with user telegram_id as notes)
         │
User completes payment in browser
         │
         ▼
Razorpay calls POST /webhook/razorpay
  │
  ├─ Verify HMAC-SHA256 signature (X-Razorpay-Signature header)
  │     └─ Invalid → 400, log warning, return
  │
  └─ Valid →
       │
       Extract telegram_id from payment.notes
       │
       UPDATE users SET tier='premium', expires_at=now()+30days
       │
       INSERT payment record to Supabase
       │
       Bot.sendMessage(telegram_id, "⭐ Premium activated!")
       │
       Return HTTP 200
```

### 2.6 Web Feed Flow

```
User visits matchcast.in
         │
         ▼
Next.js renders page
  └─ Server: fetch last 20 commentary_updates for all live matches
  └─ Client: opens EventSource to /api/stream/{matchId}?lang=hi
         │
         ▼
As new commentary arrives (via SSE):
  └─ CommentaryCard prepended to feed
  └─ Scoreboard updated
         │
User changes language toggle (e.g. hi → ta)
  └─ Close old EventSource
  └─ Open new EventSource /api/stream/{matchId}?lang=ta
  └─ Reload last 20 updates in Tamil
         │
User clicks match tab
  └─ Switch active match, reload feed for new match ID
```

### 2.7 White-Label API Flow

```
Third-party client sends:
GET /v1/commentary/1234?lang=hi&limit=10
Authorization: Bearer {api_key}
         │
         ▼
API handler validates key:
  SELECT * FROM api_keys WHERE key_hash = sha256(api_key)
  │
  ├─ Not found → 401 Unauthorized
  │
  └─ Found →
       │
       Check rate limit (express-rate-limit, 60/min per key)
       │
       ├─ Exceeded → 429 Too Many Requests + Retry-After
       │
       └─ OK →
            │
            SELECT commentary_updates WHERE match_id=1234 AND language='hi'
            ORDER BY created_at DESC LIMIT 10
            │
            Return JSON response
```

---

## 3. State Machine: Match Lifecycle

```
         ┌──────────────┐
         │   scheduled  │  ← fixture fetched, not yet live
         └──────┬───────┘
                │ kick-off detected
                ▼
         ┌──────────────┐
         │    live      │  ← Poller active at 60s interval
         └──────┬───────┘
                │ full-time detected
                ▼
         ┌──────────────┐
         │   finished   │  ← summary sent, Poller stopped
         └──────────────┘
```

---

## 4. Error Handling Flows

### Gemini API Failure

```
Gemini call fails (timeout / 429 / 5xx)
         │
         ▼
Wait 2 seconds, retry once
         │
         ├─ Success → proceed normally
         │
         └─ Failure →
              │
              Generate fallback text:
              "{event_type}: {team} — {player}, {minute}'"
              │
              Deliver fallback to user
              │
              Log error to console / Railway logs
```

### API-Football Rate Limit

```
API-Football returns 429
         │
         ▼
Poller pauses for 30 seconds
         │
         ▼
Resume polling
         │
         ▼
Log rate limit hit with timestamp
```

### Backend Restart Recovery

```
Process starts
         │
         ▼
Load all matches WHERE status='live' from Supabase
         │
         ▼
For each live match:
  └─ Resume Poller cron at 60s interval
  └─ Load last event_fingerprint timestamp
  └─ Resume from last known state
         │
         ▼
System operational within 30 seconds
```

---

## 5. Cron Job Schedule

| Job | Schedule | Purpose |
|---|---|---|
| `fetchDailyFixtures` | `*/5 * * * *` (non-match hours) | Refresh today's match list |
| `pollLiveMatches` | `* * * * *` (during match hours) | Fetch events for live matches |
| `expireSubscriptions` | `0 0 * * *` | Downgrade expired premium users |
| `refreshSponsor` | `*/5 * * * *` | Refresh active sponsor cache |

---

## 6. Data Flow Summary

```
External                Internal                  Storage
─────────               ────────                  ───────
API-Football ──events──► Poller
                             │
                             ▼
                       Event_Processor ──fingerprint──► Supabase.event_fingerprints
                             │
                             ▼
                       Commentary_Engine
                             │
                      Gemini 1.5 Flash
                             │
                             ▼
                       Sponsor_Injector ──log──────────► Supabase.sponsor_deliveries
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
               Telegram Bot       SSE Stream ──────────► Supabase.commentary_updates
                    │                 │
               Telegram API      Next.js client
```
