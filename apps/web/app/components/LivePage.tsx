'use client';

import { useState } from 'react';
import CommentaryFeed from './CommentaryFeed';
import LanguageToggle from './LanguageToggle';
import MatchSelector from './MatchSelector';
import Scoreboard from './Scoreboard';

interface MatchData {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
}

interface SSECommentaryEvent {
  type: 'commentary' | 'score_update' | 'match_end';
  update: {
    id: string;
    text: string;
    eventType: string;
    minute: number | null;
    language: string;
    timestamp: string;
  };
  score?: {
    home: number;
    away: number;
  };
}

interface LivePageProps {
  matches: MatchData[];
  initialMatchId: string;
  initialLanguage: string;
  initialUpdates: SSECommentaryEvent[];
}

export default function LivePage({
  matches,
  initialMatchId,
  initialLanguage,
  initialUpdates,
}: LivePageProps) {
  const [activeMatchId, setActiveMatchId] = useState(initialMatchId);
  const [language, setLanguage] = useState(initialLanguage);

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? matches[0];

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header
        className="bg-bg-card border-b border-white/10 px-4 py-3"
        role="banner"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              🏆
            </span>
            <span className="font-bold text-text-primary text-lg">
              MatchCast AI
            </span>
          </div>
          <LanguageToggle language={language} onSelect={setLanguage} />
        </div>
      </header>

      {/* Match selector */}
      <MatchSelector
        matches={matches}
        activeMatchId={activeMatchId}
        onSelect={setActiveMatchId}
      />

      {/* Main content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-6" id="main-content">
        {activeMatch ? (
          <>
            {/* Scoreboard */}
            <Scoreboard
              homeTeam={activeMatch.home_team}
              awayTeam={activeMatch.away_team}
              homeScore={activeMatch.home_score}
              awayScore={activeMatch.away_score}
              status={activeMatch.status}
              matchId={activeMatch.id}
            />

            {/* Commentary feed */}
            <div id="commentary-feed" role="region" aria-label="Commentary feed">
              <CommentaryFeed
                matchId={activeMatchId}
                language={language}
                initialUpdates={
                  activeMatchId === initialMatchId ? initialUpdates : []
                }
              />
            </div>
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-20 text-text-muted"
            role="status"
          >
            <span className="text-5xl mb-4" aria-hidden="true">
              🏟️
            </span>
            <p className="text-base font-medium">No matches today</p>
            <p className="text-sm mt-1">Check back before the next fixture.</p>
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <footer
        className="bg-bg-card border-t border-white/10 py-4 px-4 text-center"
        role="contentinfo"
      >
        <a
          href="https://t.me/MatchCastBot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-accent-pulse text-sm font-medium hover:underline"
          aria-label="Get MatchCast AI on Telegram"
        >
          📲 Get on Telegram → @MatchCastBot
        </a>
      </footer>
    </div>
  );
}
