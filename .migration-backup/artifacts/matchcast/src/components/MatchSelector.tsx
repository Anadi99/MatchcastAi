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

function isLive(status: string): boolean {
  const liveStatuses = ['live', 'LIVE', '1H', '2H', 'ET', 'HT', 'P'];
  return liveStatuses.includes(status);
}

export default function MatchSelector({
  matches,
  activeMatchId,
  onSelect,
}: MatchSelectorProps) {
  if (matches.length === 0) {
    return (
      <div
        className="px-4 py-3 text-text-muted text-sm text-center"
        role="status"
      >
        No matches available today.
      </div>
    );
  }

  return (
    <nav
      aria-label="Match selector"
      className="bg-bg-card border-b border-white/10"
    >
      <ol
        className="flex overflow-x-auto scrollbar-none gap-1 px-3 py-2"
        role="tablist"
        aria-label="Available matches"
      >
        {matches.map((match) => {
          const isActive = match.id === activeMatchId;
          const live = isLive(match.status);

          return (
            <li key={match.id} role="presentation">
              <button
                role="tab"
                aria-selected={isActive}
                aria-controls="commentary-feed"
                onClick={() => onSelect(match.id)}
                className={[
                  'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-pulse text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5',
                ].join(' ')}
              >
                {live && (
                  <span
                    className="text-accent-live text-xs"
                    aria-label="Live match"
                  >
                    🔴
                  </span>
                )}
                <span>
                  {match.home_team} vs {match.away_team}
                </span>
                {live && (
                  <span className="text-xs bg-accent-live/20 text-accent-live px-1.5 py-0.5 rounded font-bold">
                    LIVE
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
