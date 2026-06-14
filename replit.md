# MatchCast AI

Live football commentary in your language — Hindi, Tamil, Telugu, Marathi. Real-time SSE streaming from Supabase.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/matchcast run dev` — run the frontend (port 22888)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Required Secrets

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project dashboard URL (any URL containing `/project/<ref>` works) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (Settings → API) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4, wouter routing
- Backend: Express 5
- Database: Supabase (Postgres + Realtime)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/matchcast/` — React + Vite frontend
- `artifacts/api-server/` — Express backend serving `/api/matches` and `/api/stream/:matchId`
- `supabase_migration.sql` — Schema migration to run in Supabase SQL Editor

## Architecture decisions

- Frontend fetches matches from `/api/matches` on load; uses SSE at `/api/stream/:matchId?lang=<lang>` for real-time commentary
- SUPABASE_URL is auto-resolved: both dashboard URLs and `https://<ref>.supabase.co` formats work
- No server-side rendering — fully client-rendered Vite SPA
- Language selector (Hindi/Tamil/Telugu/Marathi) drives both SSE stream filter and UI

## ⚠️ One-time setup required

The Supabase database schema must be applied once before match data appears:

1. Go to your Supabase project → **SQL Editor**
2. Open `supabase_migration.sql` from this repo (or paste the contents)
3. Run it — this creates all tables (matches, commentary_updates, etc.)

## Product

Users visit the app to watch live AI-generated football commentary in Indian regional languages. They pick a match from the selector bar, choose their language, and see a real-time commentary feed streamed via SSE from Supabase Realtime. A Telegram bot (@MatchCastBot) delivers the same commentary via push.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The api-server resolves SUPABASE_URL automatically from dashboard or API URL format
- Direct Postgres connection to Supabase (`db.*.supabase.co`) is DNS-blocked in this Replit environment — use Supabase REST API or run migrations via SQL Editor
- Port 8080 (api-server) can get stuck with EADDRINUSE if workflows restart too quickly — wait a few seconds between restarts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
