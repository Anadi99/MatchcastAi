import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyAuth } from './auth';
import { getCommentaryForMatch } from '../db/commentary';
import { supabase } from '../db/client';
import type { Language, MatchStatus, EventType } from '../types/db';

const VALID_LANGS: Language[] = ['hi', 'ta', 'te', 'mr'];

/**
 * Rate limiter: 60 requests per minute, keyed by API key ID (or IP as fallback).
 * Returns 429 with Retry-After header and structured body on breach.
 */
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req: Request) => req.apiKey?.id ?? (req.ip ?? 'unknown'),
  handler: (_req: Request, res: Response) => {
    res.set('Retry-After', '60');
    res.status(429).json({ error: 'Too Many Requests', retryAfter: 60 });
  },
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => false,
});

const apiRouter = Router();

/**
 * GET /v1/commentary/:matchId
 *
 * Returns the latest commentary updates for a match in a given language.
 * Query params:
 *   - lang  (default: 'hi', must be one of 'hi'|'ta'|'te'|'mr')
 *   - limit (default: 10, min: 1, max: 50)
 */
apiRouter.get(
  '/commentary/:matchId',
  apiKeyAuth,
  rateLimiter,
  async (req, res) => {
    const { matchId } = req.params;

    // --- Parse and validate query params ---
    const rawLang = (req.query['lang'] as string | undefined) ?? 'hi';
    const lang: Language = VALID_LANGS.includes(rawLang as Language)
      ? (rawLang as Language)
      : 'hi';

    const rawLimit = parseInt((req.query['limit'] as string | undefined) ?? '10', 10);
    const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));

    // --- Fetch match by fixture_id ---
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('fixture_id', parseInt(matchId, 10))
      .single();

    if (matchError || !match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const fixtureId: number = match.fixture_id as number;

    // --- Fetch commentary updates ---
    const updates = await getCommentaryForMatch(fixtureId, lang, limit);

    // --- Build WhiteLabelResponse ---
    res.json({
      matchId: String(fixtureId),
      language: lang,
      match: {
        homeTeam: match.home_team as string,
        awayTeam: match.away_team as string,
        homeScore: match.home_score as number,
        awayScore: match.away_score as number,
        status: match.status as MatchStatus,
        minute: null,
      },
      updates: updates.map((u) => ({
        id: u.id,
        text: u.content,
        eventType: u.event_type as EventType,
        minute: u.event_minute ?? null,
        timestamp: u.created_at,
      })),
      total: updates.length,
    });
  }
);

export default apiRouter;
