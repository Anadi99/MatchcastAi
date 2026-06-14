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
  score?: { home: number; away: number };
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="bg-bg-card border-b border-border-subtle px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="w-32 h-5 skeleton rounded" />
          <div className="w-48 h-8 skeleton rounded-lg" />
        </div>
      </div>
      <div className="bg-bg-card border-b border-border-subtle px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-6">
          <div className="flex-1 flex justify-end">
            <div className="w-28 h-5 skeleton rounded" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-8 skeleton rounded" />
            <div className="w-16 h-5 skeleton rounded-full" />
          </div>
          <div className="flex-1">
            <div className="w-28 h-5 skeleton rounded" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border-card bg-bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 skeleton rounded-full" />
              <div className="w-16 h-3 skeleton rounded" />
              <div className="ml-auto w-8 h-3 skeleton rounded" />
            </div>
            <div className="space-y-2">
              <div className="w-full h-3 skeleton rounded" />
              <div className={`h-3 skeleton rounded`} style={{ width: `${65 + i * 8}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-text-muted animate-slide-up" role="status">
      <p className="text-base font-semibold text-text-secondary mb-1">No matches today</p>
      <p className="text-sm">Check back before the next fixture.</p>
    </div>
  );
}

export default function HomePage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [activeMatchId, setActiveMatchId] = useState('');
  const [language, setLanguage] = useState('hi');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [initialUpdates] = useState<SSECommentaryEvent[]>([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    fetch(`${base}/api/demo`).then(r => r.json()).then((d: { demo?: boolean }) => {
      if (d.demo) setDemoMode(true);
    }).catch(() => {});
    fetch(`${base}/api/matches`)
      .then((r) => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as MatchData[]) : [];
        setMatches(list);
        const firstLive = list.find((m) => m.status === 'live') ?? list[0];
        if (firstLive) setActiveMatchId(firstLive.id);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? matches[0];

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header
        className="border-b border-border-subtle"
        style={{ background: 'rgba(19, 22, 31, 0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 20 }}
        role="banner"
      >
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-text-primary tracking-tight text-base">MatchCast</span>
            <span className="text-border-subtle">|</span>
            <span className="text-text-muted text-xs font-medium tracking-wide uppercase">AI Commentary</span>
            {demoMode && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold text-text-muted border border-border-card">
                demo
              </span>
            )}
          </div>
          <LanguageToggle language={language} onSelect={setLanguage} />
        </div>
      </header>

      <MatchSelector
        matches={matches}
        activeMatchId={activeMatchId}
        onSelect={setActiveMatchId}
      />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-8" id="main-content">
        {apiError && (
          <div className="mt-4 rounded-lg border border-border-card bg-bg-card px-4 py-3">
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">Database not connected.</span>{' '}
              Set <code className="text-xs bg-white/8 px-1.5 py-0.5 rounded font-mono text-accent-pulse">SUPABASE_URL</code> and{' '}
              <code className="text-xs bg-white/8 px-1.5 py-0.5 rounded font-mono text-accent-pulse">SUPABASE_SERVICE_ROLE_KEY</code> in Secrets to load live data.
            </p>
          </div>
        )}

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
          <EmptyState />
        )}
      </main>

      <footer
        className="border-t border-border-subtle py-4 px-4 text-center"
        style={{ background: 'rgba(19, 22, 31, 0.8)' }}
        role="contentinfo"
      >
        <span className="text-xs text-text-muted">
          Built by Anadi &mdash; real-time football commentary in Indian languages
        </span>
      </footer>
    </div>
  );
}
