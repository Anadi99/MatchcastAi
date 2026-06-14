interface CommentaryCardProps {
  id: string;
  text: string;
  eventType: string;
  minute: number | null;
  timestamp: string;
  isSponsor?: boolean;
}

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'goal':
      return '⚽';
    case 'card':
      return '🟨';
    case 'subst':
      return '🔄';
    case 'var':
      return '🖥️';
    case 'pulse':
      return '⏱️';
    case 'summary':
      return '📋';
    default:
      return '⚡';
  }
}

export default function CommentaryCard({
  text,
  eventType,
  minute,
  timestamp,
  isSponsor = false,
}: CommentaryCardProps) {
  const icon = getEventIcon(eventType);
  const bgClass = isSponsor ? 'bg-bg-sponsor' : 'bg-bg-card';
  const label = `${eventType}${minute !== null ? ` at minute ${minute}` : ''}`;

  return (
    <article
      role="article"
      aria-label={label}
      className={`${bgClass} rounded-lg p-4 mb-3 border border-white/5`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden="true" className="text-lg">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {eventType}
        </span>
        {minute !== null && (
          <time
            dateTime={`PT${minute}M`}
            className="text-xs text-text-muted ml-auto"
            aria-label={`Minute ${minute}`}
          >
            {minute}&apos;
          </time>
        )}
      </div>
      <p className="text-text-primary text-sm leading-relaxed">{text}</p>
      {isSponsor && (
        <div
          className="mt-2 text-xs text-text-muted"
          aria-label="Sponsored content"
        >
          💡 Sponsored
        </div>
      )}
      <time
        dateTime={timestamp}
        className="sr-only"
      >
        {new Date(timestamp).toLocaleString()}
      </time>
    </article>
  );
}
