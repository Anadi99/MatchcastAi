---
name: Mobile data layer (Mode B)
description: MatchCast mobile uses direct fetch() calls to the Express API, not @workspace/api-client-react hooks.
---

## Rule
This project is **Mode B** — the web app and mobile app both call the Express API directly via fetch(). The `@workspace/api-client-react` dependency is listed in package.json but NOT used for actual data fetching.

**Why:** The web app was migrated from an import that used raw fetch. The generated hooks in api-client-react only cover /healthz (from the OpenAPI spec). The Supabase-backed match/commentary endpoints were added as hand-written Express routes — not in the OpenAPI spec — so no generated hooks exist for them.

**How to apply:**
- Mobile API client lives at `artifacts/matchcast-mobile/lib/api.ts`
- It reads `process.env.EXPO_PUBLIC_DOMAIN` for the base URL, falls back to `http://localhost:8080`
- `fetchMatches()` → `GET /api/matches`
- `fetchCommentary(matchId, lang)` → `GET /api/commentary/:matchId?lang=&limit=30`
- React Query polling: matches every 30s, commentary every 5s
- Web uses SSE (`EventSource`) for commentary; mobile uses polling (no native SSE client needed)
