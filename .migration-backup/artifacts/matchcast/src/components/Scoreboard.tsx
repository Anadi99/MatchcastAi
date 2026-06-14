interface ScoreboardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  matchId: string;
}

function StatusBadge({ status }: { status: string }) {
  const isLive =
    status === 'live' ||
    status === 'LIVE' ||
    status === '1H' ||
    status === '2H' ||
    status === 'ET';

  if (isLive) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-live/20 text-accent-live text-xs font-bold"
        role="status"
        aria-label="Match is live"
      >
        🔴 LIVE
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-text-muted text-xs font-medium"
      role="status"
      aria-label={`Match status: ${status}`}
    >
      ⏰ {status}
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
  return (
    <header
      className="sticky top-0 z-10 bg-bg-card border-b border-white/10 py-3 px-4"
      aria-label="Match scoreboard"
      data-match-id={matchId}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <span className="font-semibold text-text-primary text-sm sm:text-base truncate">
              {homeTeam}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className="text-2xl font-bold text-text-primary tabular-nums"
              aria-label={`Score: ${homeScore} to ${awayScore}`}
            >
              {homeScore} – {awayScore}
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="flex-1 text-left">
            <span className="font-semibold text-text-primary text-sm sm:text-base truncate">
              {awayTeam}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
