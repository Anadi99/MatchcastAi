---
name: Demo mode pattern
description: How the API server auto-detects missing Supabase credentials and serves rich demo data instead of erroring.
---

## Rule
When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both absent, the API server enters demo mode — it serves hardcoded World Cup 2026 fixture and commentary data instead of calling Supabase. The SSE `/api/stream/:matchId` endpoint drip-feeds new commentary lines every 10 seconds for the live match.

**Why:** Supabase credentials are not set by default in Replit. Without a fallback the app returned 500 on every request, making it impossible to demo or evaluate. Demo mode lets anyone open the project and see it working instantly.

**How to apply:** The `isDemoMode()` helper in `artifacts/api-server/src/routes/matches.ts` checks the env vars. Each route handler calls it at the top and branches. Switching to live data requires only adding Supabase secrets — zero code changes needed.

## Detection
```ts
function isDemoMode(): boolean {
  const url = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  return !url || !key;
}
```

## Demo fixtures
- India vs Brazil — LIVE 1–0 (73')
- France vs England — Upcoming
- Argentina vs Germany — FT 2–1

Commentary is available in all 4 languages: hi, ta, te, mr.

## Web indicator
`GET /api/demo` returns `{"demo":true}`. `HomePage.tsx` fetches this on mount and renders a blue `DEMO` badge in the header.
