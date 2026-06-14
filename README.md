# MatchCast AI

Real-time football commentary in Indian languages — Hindi, Tamil, Telugu, and Marathi.

I built this because I wanted to watch football in my language. Most commentary apps are English-only, so I built one that streams AI-generated commentary in regional Indian languages as the match happens. It works across web and mobile, and streams updates live via SSE.

![MatchCast AI Web App](screenshots/matchcast-home.jpg)

---

## What it does

- Streams AI-generated match commentary in Hindi, Tamil, Telugu, and Marathi
- Handles live goals, cards, substitutions, VAR reviews, and half-time with distinct event styling
- Web app uses SSE for real-time push; mobile app polls every 5 seconds
- Built as a proper monorepo — shared types between web, mobile, and API

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Tailwind CSS v4 |
| Mobile | Expo SDK 54, React Native, Expo Router |
| Backend | Node.js 24, Express 5, TypeScript |
| Database | Supabase (Postgres + Realtime) |
| Realtime | Server-Sent Events + Supabase CDC |
| Monorepo | pnpm workspaces |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  Web (React + SSE)      Mobile (Expo, 5s polling)   │
└────────────────────┬────────────────┬────────────────┘
                     │                │
                     ▼                ▼
┌──────────────────────────────────────────────────────┐
│                 Express API Server                   │
│  GET /api/matches                                    │
│  GET /api/stream/:matchId   (SSE)                   │
│  GET /api/commentary/:matchId   (REST)              │
└──────────────────────┬───────────────────────────────┘
                       │ Supabase JS
                       ▼
┌──────────────────────────────────────────────────────┐
│                    Supabase                          │
│  matches  |  commentary_updates  |  users/sponsors  │
│              Postgres + Realtime CDC                │
└──────────────────────────────────────────────────────┘
```

Data flow: an AI pipeline inserts a row into `commentary_updates` → Supabase fires a CDC event → the API server receives it and pushes it over SSE → the browser renders the new card, usually within a second.

## Project structure

```
matchcast/
├── artifacts/
│   ├── matchcast/           # React + Vite web app
│   ├── api-server/          # Express 5 API (SSE + REST)
│   └── matchcast-mobile/    # Expo React Native app
├── lib/
│   ├── api-spec/            # OpenAPI spec
│   ├── api-client-react/    # Generated React Query hooks
│   └── db/                  # Drizzle ORM schema
└── supabase_migration.sql
```

## Running it

### Without Supabase (demo mode)

Just clone and run — no credentials needed. The API serves World Cup 2026 demo fixtures with pre-written commentary in all four languages and streams new lines every 10 seconds to simulate a live match. A "demo" badge shows in the header.

```bash
git clone https://github.com/Anadi99/MatchcastAi.git
cd MatchcastAi
pnpm install

# In separate terminals:
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/matchcast run dev
pnpm --filter @workspace/matchcast-mobile run dev
```

### With Supabase (live data)

1. Run `supabase_migration.sql` in your Supabase SQL editor
2. Set secrets:

```env
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
```

3. Seed a match and insert commentary rows — the SSE stream will pick them up immediately.

```sql
INSERT INTO matches (fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at)
VALUES (1001, 'India', 'Brazil', 1, 0, 'live', NOW());

INSERT INTO commentary_updates (fixture_id, content, event_type, event_minute, language)
VALUES (1001, 'सुनील छेत्री ने शानदार गोल दागा!', 'goal', 23, 'hi');
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/matches` | Today's matches |
| `GET /api/stream/:id?lang=hi` | SSE stream for a match |
| `GET /api/commentary/:id?lang=hi&limit=30` | REST polling fallback |
| `GET /api/demo` | Returns `{"demo":true}` in demo mode |
| `GET /api/healthz` | Health check |

Supported languages: `hi` Hindi, `ta` Tamil, `te` Telugu, `mr` Marathi

## Why SSE over WebSockets

Commentary is one-directional — server pushes, client reads. SSE is simpler, works over HTTP/1.1, and reconnects automatically in the browser. No extra library, no handshake protocol. For this use case it's the right call.

## Roadmap

- AI commentary ingestion pipeline (football data API + LLM)
- Push notifications via Telegram
- User auth + premium tier
- Historical match archive
- Admin panel for match and sponsor management

---

MIT License
