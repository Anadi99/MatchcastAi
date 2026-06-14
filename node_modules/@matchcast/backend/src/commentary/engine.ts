import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Language, MatchEventPayload, CommentaryResult } from '../types/db';
import type { Match } from '../types/db';
import type { ApiStatistic } from '../poller/apiFootball';

// ── Gemini client ─────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ── Language configuration ────────────────────────────────────────────────────

const TONE_DIRECTIVES: Record<Language, string> = {
  hi: 'dramatic, high-emotion, Bollywood-style',
  ta: 'poetic, lyrical, classical Tamil expression',
  te: 'energetic, exclamatory, Telugu film style',
  mr: 'conversational, local Marathi warmth',
};

const LANGUAGE_NAMES: Record<Language, string> = {
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini with a prompt and an optional per-call timeout (ms).
 * Returns the raw text or throws on error / timeout.
 */
async function callGemini(prompt: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent(prompt);
    clearTimeout(timer);
    return result.response.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── generate ──────────────────────────────────────────────────────────────────

/**
 * Generate a 2–3 sentence live commentary update for a match event.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export async function generate(
  payload: MatchEventPayload,
  language: Language,
): Promise<CommentaryResult> {
  const languageName = LANGUAGE_NAMES[language];
  const toneDirective = TONE_DIRECTIVES[language];

  const prompt = [
    `You are a passionate Indian football commentator speaking in ${languageName}.`,
    `A match event just occurred: ${payload.eventType} — ${payload.eventDetail}.`,
    `Current score: ${payload.homeTeam} ${payload.homeScore} – ${payload.awayScore} ${payload.awayTeam}.`,
    `Minute: ${payload.minute}. Venue: ${payload.venue}.`,
    `Tone: ${toneDirective}.`,
    `Write a 2–3 sentence live commentary update in ${languageName}.`,
    `Rules: Sound like a real TV commentator, emotional and vivid.`,
    `Use local expressions and cricket-style drama.`,
    `Never use English unless it's a player or team name.`,
    `End with a short reaction line. Max 60 words.`,
  ].join('\n');

  const fallbackText =
    `${payload.eventType}: ${payload.homeTeam} vs ${payload.awayTeam} — ${payload.eventDetail}, ${payload.minute}'`;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      await sleep(2000);
    }
    try {
      const text = await callGemini(prompt, 10_000);
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      const wordCount = countWords(text);
      if (wordCount > 60) {
        throw new Error(`Response exceeds 60 words (got ${wordCount})`);
      }
      return { text: text.trim(), language, wordCount, isFallback: false };
    } catch {
      // On first attempt, loop and retry; on second, fall through to fallback
    }
  }

  return {
    text: fallbackText,
    language,
    wordCount: countWords(fallbackText),
    isFallback: true,
  };
}

// ── generatePulse ─────────────────────────────────────────────────────────────

/**
 * Generate a 1–2 sentence match tempo/situation pulse update.
 *
 * Requirements: 3.2, 3.3, 3.4
 */
export async function generatePulse(
  payload: {
    fixtureId: number;
    match: Match;
    statistics: ApiStatistic[];
  },
  language: Language,
): Promise<CommentaryResult> {
  const { match, statistics } = payload;
  const languageName = LANGUAGE_NAMES[language];
  const toneDirective = TONE_DIRECTIVES[language];

  // Extract possession percentages for each team from statistics
  let homePossession = 50;
  let awayPossession = 50;

  for (const teamStat of statistics) {
    const possessionStat = teamStat.statistics.find(
      (s) => s.type === 'Ball Possession',
    );
    if (possessionStat !== undefined && possessionStat.value !== null) {
      const raw = String(possessionStat.value).replace('%', '');
      const pct = parseInt(raw, 10);
      if (!isNaN(pct)) {
        if (teamStat.team.name === match.home_team) {
          homePossession = pct;
        } else if (teamStat.team.name === match.away_team) {
          awayPossession = pct;
        }
      }
    }
  }

  // Approximate minute from match status; use current UTC time delta from kickoff
  const kickoffMs = new Date(match.kickoff_at).getTime();
  const elapsedMinutes = Math.floor((Date.now() - kickoffMs) / 60_000);
  const minute = Math.max(0, Math.min(90, elapsedMinutes));

  const prompt = [
    `You are a passionate Indian football commentator speaking in ${languageName}.`,
    `Match situation: ${match.home_team} vs ${match.away_team}, ${minute} minutes played.`,
    `Score: ${match.home_score} – ${match.away_score}.`,
    `${match.home_team} possession: ${homePossession}%. ${match.away_team} possession: ${awayPossession}%.`,
    `Tone: ${toneDirective}.`,
    `Write a 1–2 sentence match tempo/situation update in ${languageName}. Max 60 words. End with a reaction line.`,
  ].join('\n');

  const fallbackText =
    `Match update: ${match.home_team} ${match.home_score} – ${match.away_score} ${match.away_team}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      await sleep(2000);
    }
    try {
      const text = await callGemini(prompt, 10_000);
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      const wordCount = countWords(text);
      if (wordCount > 60) {
        throw new Error(`Response exceeds 60 words (got ${wordCount})`);
      }
      return { text: text.trim(), language, wordCount, isFallback: false };
    } catch {
      // On first attempt, loop and retry; on second, fall through to fallback
    }
  }

  return {
    text: fallbackText,
    language,
    wordCount: countWords(fallbackText),
    isFallback: true,
  };
}

// ── generateSummary ───────────────────────────────────────────────────────────

/**
 * Generate a 5-line match summary at full time.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */
export async function generateSummary(matchData: {
  match: Match;
  language: Language;
}): Promise<CommentaryResult> {
  const { match, language } = matchData;
  const languageName = LANGUAGE_NAMES[language];
  const toneDirective = TONE_DIRECTIVES[language];

  const prompt = [
    `You are a passionate Indian football commentator speaking in ${languageName}.`,
    `The match has ended: ${match.home_team} ${match.home_score} – ${match.away_score} ${match.away_team}.`,
    `Tone: ${toneDirective}.`,
    `Write a 5-line match summary in ${languageName}:`,
    `Line 1: Final score and result`,
    `Line 2: Key goals and moments`,
    `Line 3: Player of the match`,
    `Line 4: Tactical verdict`,
    `Line 5: Emotional closing line`,
    `Keep it under 120 words total.`,
  ].join('\n');

  const fallbackText =
    `Full time: ${match.home_team} ${match.home_score} – ${match.away_score} ${match.away_team}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      await sleep(2000);
    }
    try {
      const text = await callGemini(prompt, 30_000);
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      const wordCount = countWords(text);
      return { text: text.trim(), language, wordCount, isFallback: false };
    } catch {
      // On first attempt, loop and retry; on second, fall through to fallback
    }
  }

  return {
    text: fallbackText,
    language,
    wordCount: countWords(fallbackText),
    isFallback: true,
  };
}
