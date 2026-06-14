interface MatchOption {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  status: string;
}

interface MatchSelectorProps {
  matches: MatchOption[];
  activeMatchId: string;
  onSelect: (matchId: string) => void;
}

const LIVE_STATUSES = new Set(['live', 'LIVE', '1H', '2H', 'ET', 'HT', 'P']);

function isLive(status: string) {
  return LIVE_STATUSES.has(status);
}

function isFinished(status: string) {
  return status === 'finished' || status === 'FT';
}

export default function MatchSelector({ matches, activeMatchId, onSelect }: MatchSelectorProps) {
  if (matches.length === 0) return null;

  return (
    <nav
      aria-label="Match selector"
      className="border-b border-border-subtle"
      style={{ background: 'rgba(19, 22, 31, 0.8)', backdropFilter: 'blur(8px)' }}
    >
      <ol
        className="flex overflow-x-auto scrollbar-none gap-1.5 px-4 py-2.5"
        role="tablist"
        aria-label="Available matches"
      >
        {matches.map((match) => {
          const isActive = match.id === activeMatchId;
          const live = isLive(match.status);
          const finished = isFinished(match.status);

          return (
            <li key={match.id} role="presentation" className="shrink-0">
              <button
                role="tab"
                aria-selected={isActive}
                aria-controls="commentary-feed"
                onClick={() => onSelect(match.id)}
                className={[
                  'flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent-pulse text-white shadow-sm'
                    : finished
                    ? 'text-text-muted hover:text-text-secondary hover:bg-white/5'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/6',
                ].join(' ')}
              >
                {live && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-live live-pulse shrink-0" aria-label="Live" />
                )}
                <span>
                  {match.home_team} <span className="opacity-50">vs</span> {match.away_team}
                </span>
                {live && (
                  <span className={`text-xs font-bold tracking-wider shrink-0 ${isActive ? 'text-white/80' : 'text-accent-live'}`}>
                    LIVE
                  </span>
                )}
                {finished && (
                  <span className={`text-xs shrink-0 ${isActive ? 'text-white/60' : 'text-text-muted'}`}>FT</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
