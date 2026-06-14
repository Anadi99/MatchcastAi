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

const EVENT_META: Record<string, { icon: string; label: string; accent: string }> = {
  goal:         { icon: '⚽', label: 'Goal',         accent: 'goal' },
  card:         { icon: '🟨', label: 'Yellow Card',  accent: 'card' },
  yellow_card:  { icon: '🟨', label: 'Yellow Card',  accent: 'card' },
  redcard:      { icon: '🟥', label: 'Red Card',     accent: 'redcard' },
  red_card:     { icon: '🟥', label: 'Red Card',     accent: 'redcard' },
  subst:        { icon: '🔄', label: 'Substitution', accent: 'subst' },
  substitution: { icon: '🔄', label: 'Substitution', accent: 'subst' },
  var:          { icon: '🖥️', label: 'VAR Review',   accent: 'var' },
  kickoff:      { icon: '🏁', label: 'Kick Off',     accent: 'pulse' },
  half_time:    { icon: '🔔', label: 'Half Time',    accent: 'summary' },
  full_time:    { icon: '🏆', label: 'Full Time',    accent: 'summary' },
  pulse:        { icon: '⏱️', label: 'Update',       accent: 'pulse' },
  commentary:   { icon: '💬', label: 'Commentary',   accent: 'default' },
  summary:      { icon: '📋', label: 'Summary',      accent: 'summary' },
  sponsor:      { icon: '💡', label: 'Sponsored',    accent: 'sponsor' },
};

function getEventMeta(eventType: string) {
  return EVENT_META[eventType.toLowerCase()] ?? { icon: '⚡', label: eventType, accent: 'default' };
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function GoalCard({ text, minute, timestamp }: { text: string; minute: number | null; timestamp: string }) {
  return (
    <article className="card-enter rounded-xl mb-3 overflow-hidden border border-accent-gold/25 bg-bg-goal">
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">⚽</span>
        <span className="text-accent-gold font-bold text-sm uppercase tracking-widest">Goal!</span>
        {minute !== null && (
          <span className="ml-auto text-xs font-bold text-accent-gold tabular-nums">{minute}&apos;</span>
        )}
      </div>
      <p className="px-4 pb-3 text-text-primary text-sm leading-relaxed font-medium">{text}</p>
      <div className="px-4 pb-2 flex items-center justify-end">
        <span className="text-xs text-text-muted">{formatTimestamp(timestamp)}</span>
      </div>
    </article>
  );
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
  const meta = getEventMeta(isSponsor ? 'sponsor' : eventType);

  useEffect(() => {
    if (isNew && ref.current) {
      ref.current.classList.add('card-enter');
    }
  }, [isNew]);

  if (eventType === 'goal' && !isSponsor) {
    return <GoalCard text={text} minute={minute} timestamp={timestamp} />;
  }

  const sponsorBg = 'bg-bg-sponsor border-accent-green/15';
  const defaultBg = 'bg-bg-card border-border-card hover:border-white/12';
  const borderBg = isSponsor ? sponsorBg : defaultBg;

  return (
    <article
      ref={ref}
      className={`card-enter rounded-xl mb-3 border transition-colors ${borderBg}`}
      aria-label={`${meta.label}${minute !== null ? ` at minute ${minute}` : ''}`}
    >
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base" aria-hidden="true">{meta.icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {meta.label}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {minute !== null && (
              <span className="text-xs font-bold text-text-secondary tabular-nums bg-white/5 px-1.5 py-0.5 rounded">
                {minute}&apos;
              </span>
            )}
            <span className="text-xs text-text-muted tabular-nums">{formatTimestamp(timestamp)}</span>
          </div>
        </div>
        <p className="text-text-primary text-sm leading-relaxed">{text}</p>
        {isSponsor && (
          <p className="mt-2 text-xs text-accent-green/70">Sponsored</p>
        )}
      </div>
    </article>
  );
}
