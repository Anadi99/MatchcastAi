import { useState, useEffect } from 'react';
import CommentaryFeed from '../components/CommentaryFeed';
import LanguageToggle from '../components/LanguageToggle';
import MatchSelector from '../components/MatchSelector';
import Scoreboard from '../components/Scoreboard';

interface MatchData {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  kickoff_at: string;
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

export default function HomePage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [activeMatchId, setActiveMatchId] = useState('');
  const [language, setLanguage] = useState('hi');
  const [loading, setLoading] = useState(true);
  const [initialUpdates] = useState<SSECommentaryEvent[]>([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    fetch(`${base}/api/matches`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as MatchData[]) : [];
        setMatches(list);
        const firstLive = list.find((m) => m.status === 'live') ?? list[0];
        if (firstLive) setActiveMatchId(firstLive.id);
      })
      .catch(() => {
        // render empty state on error
      })
      .finally(() => setLoading(false));
  }, []);

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? matches[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading matches…</div>
      </div>
    );
  }

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
            <Scoreboard
              homeTeam={activeMatch.home_team}
              awayTeam={activeMatch.away_team}
              homeScore={activeMatch.home_score}
              awayScore={activeMatch.away_score}
              status={activeMatch.status}
              matchId={activeMatch.id}
            />

            <div id="commentary-feed" role="region" aria-label="Commentary feed">
              <CommentaryFeed
                matchId={activeMatchId}
                language={language}
                initialUpdates={
                  activeMatchId === (matches.find((m) => m.status === 'live') ?? matches[0])?.id
                    ? initialUpdates
                    : []
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
