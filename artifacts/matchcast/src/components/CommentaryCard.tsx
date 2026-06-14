import { useEffect, useRef } from 'react';

interface CommentaryCardProps {
  id: string;
  text: string;
  eventType: string;
  minute: number | null;
  timestamp: string;
  isSponsor?: boolean;
  isNew?: boolean;
}

const EVENT_CONFIG: Record<string, { dot: string; label: string }> = {
  goal:         { dot: '#F59E0B', label: 'Goal' },
  card:         { dot: '#FBBF24', label: 'Yellow Card' },
  yellow_card:  { dot: '#FBBF24', label: 'Yellow Card' },
  redcard:      { dot: '#EF4444', label: 'Red Card' },
  red_card:     { dot: '#EF4444', label: 'Red Card' },
  subst:        { dot: '#3B82F6', label: 'Substitution' },
  substitution: { dot: '#3B82F6', label: 'Substitution' },
  var:          { dot: '#8B5CF6', label: 'VAR' },
  kickoff:      { dot: '#22C55E', label: 'Kick-off' },
  half_time:    { dot: '#94A3B8', label: 'Half Time' },
  full_time:    { dot: '#94A3B8', label: 'Full Time' },
  commentary:   { dot: '#475569', label: '' },
  pulse:        { dot: '#475569', label: '' },
  sponsor:      { dot: '#22C55E', label: 'Sponsored' },
  summary:      { dot: '#94A3B8', label: '' },
};

function getConfig(eventType: string) {
  return EVENT_CONFIG[eventType.toLowerCase()] ?? { dot: '#475569', label: '' };
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function CommentaryCard({
  text,
  eventType,
  minute,
  timestamp,
  isSponsor = false,
  isNew = false,
}: CommentaryCardProps) {
  const ref = useRef<HTMLElement>(null);
  const config = getConfig(isSponsor ? 'sponsor' : eventType);
  const isGoal = eventType === 'goal' && !isSponsor;

  useEffect(() => {
    if (isNew && ref.current) {
      ref.current.classList.add('card-enter');
    }
  }, [isNew]);

  return (
    <article
      ref={ref}
      className={[
        'card-enter rounded-lg mb-2.5 border transition-colors overflow-hidden',
        isGoal
          ? 'border-accent-gold/20 bg-bg-goal'
          : isSponsor
          ? 'border-border-card bg-bg-sponsor'
          : 'border-border-card bg-bg-card hover:border-white/10',
      ].join(' ')}
      aria-label={`${config.label || 'Commentary'}${minute !== null ? ` at minute ${minute}` : ''}`}
    >
      {/* Accent left bar for non-commentary events */}
      {config.label && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg"
          style={{ backgroundColor: config.dot, position: 'absolute' }}
        />
      )}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          {config.label && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: config.dot }}
              aria-hidden="true"
            />
          )}
          {config.label && (
            <span className="text-xs font-semibold tracking-wide" style={{ color: config.dot }}>
              {config.label}
            </span>
          )}
          <div className={`flex items-center gap-2 ${config.label ? 'ml-auto' : 'ml-auto'}`}>
            {minute !== null && (
              <span className="text-xs font-semibold text-text-secondary tabular-nums">
                {minute}&apos;
              </span>
            )}
            <span className="text-xs text-text-muted tabular-nums">{formatTimestamp(timestamp)}</span>
          </div>
        </div>
        <p className={`text-sm leading-relaxed ${isGoal ? 'text-text-primary font-medium' : 'text-text-primary'}`}>
          {text}
        </p>
        {isSponsor && (
          <p className="mt-1.5 text-xs text-accent-green/60 font-medium">Sponsored</p>
        )}
      </div>
    </article>
  );
}
