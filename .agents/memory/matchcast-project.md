---
name: MatchCast AI project
description: Key facts about the MatchCast AI project structure, secrets, and architecture
---

## Stack
- Web frontend: `artifacts/matchcast/` — React + Vite + Tailwind v4, wouter routing, port 22888
- API server: `artifacts/api-server/` — Express 5, port 8080; uses @supabase/supabase-js directly (NOT drizzle for matches)
- Mobile: `artifacts/matchcast-mobile/` — Expo SDK 54, React Native 0.81
- Supabase: Postgres + Realtime for SSE commentary streaming

## Required Secrets
- `SUPABASE_URL` — project API URL or dashboard URL (auto-resolved)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key from Supabase Settings > API

## API Routes
- `GET /api/matches` — today's matches from Supabase `matches` table
- `GET /api/stream/:matchId?lang=hi` — SSE stream from Supabase Realtime
- `GET /api/commentary/:matchId?lang=hi&limit=30` — REST polling for mobile

## One-time DB setup
Run `supabase_migration.sql` in Supabase SQL Editor before first use.

**Why:** Direct Postgres connection to Supabase is DNS-blocked in Replit — must use Supabase JS client (REST/Realtime).

## Design tokens
Dark theme: bg-primary #0A0D14, bg-card #13161F, accent-pulse #3B82F6, accent-live #EF4444, accent-gold #F59E0B
