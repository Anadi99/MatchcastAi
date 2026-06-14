interface ScoreboardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  matchId: string;
}

const LIVE_STATUSES = new Set(['live', 'LIVE', '1H', '2H', 'ET', 'HT', 'P']);

function isLive(status: string) {
  return LIVE_STATUSES.has(status);
}

function StatusBadge({ status }: { status: string }) {
  const live = isLive(status);
  if (live) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-live/15 text-accent-live text-xs font-bold tracking-wider"
        role="status"
        aria-label="Match is live"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent-live live-pulse inline-block" aria-hidden="true" />
        LIVE
      </span>
    );
  }

  const label =
    status === 'finished' || status === 'FT' ? 'Full Time' :
    status === 'scheduled' ? 'Upcoming' :
    status;

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 text-text-muted text-xs font-medium"
      role="status"
    >
      {label}
    </span>
  );
}

function TeamName({ name }: { name: string }) {
  return (
    <span className="font-semibold text-text-primary text-sm sm:text-base leading-tight max-w-[120px] sm:max-w-[160px] text-balance">
      {name}
    </span>
  );
}

export default function Scoreboard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status,
  matchId,
}: ScoreboardProps) {
  const live = isLive(status);

  return (
    <div
      className="sticky top-0 z-10 border-b border-border-subtle"
      style={{ background: 'rgba(10, 13, 20, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      aria-label="Match scoreboard"
      data-match-id={matchId}
    >
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex-1 text-right">
            <TeamName name={homeTeam} />
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className={[
                'text-3xl font-bold tabular-nums tracking-tight',
                live ? 'text-text-primary' : 'text-text-secondary',
              ].join(' ')}
              aria-label={`Score: ${homeScore} to ${awayScore}`}
            >
              {homeScore}
              <span className="text-text-muted mx-2">–</span>
              {awayScore}
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="flex-1 text-left">
            <TeamName name={awayTeam} />
          </div>
        </div>
      </div>
    </div>
  );
}
