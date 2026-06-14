import { useEffect, useRef, useState } from 'react';
import CommentaryCard from './CommentaryCard';

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

type ConnectionState = 'connecting' | 'connected' | 'error' | 'idle';

interface CommentaryFeedProps {
  matchId: string;
  language: string;
  initialUpdates: SSECommentaryEvent[];
}

function ConnectionDot({ state }: { state: ConnectionState }) {
  if (state === 'idle') return null;
  const colors: Record<ConnectionState, string> = {
    connecting: 'bg-accent-gold animate-pulse',
    connected:  'bg-accent-green live-pulse',
    error:      'bg-text-muted',
    idle:       '',
  };
  const labels: Record<ConnectionState, string> = {
    connecting: 'Connecting…',
    connected:  'Live',
    error:      'Reconnecting…',
    idle:       '',
  };
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
      <span className={`w-1.5 h-1.5 rounded-full ${colors[state]}`} aria-hidden="true" />
      {labels[state]}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl mb-3 border border-border-card bg-bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 skeleton rounded" />
        <div className="w-16 h-3 skeleton rounded" />
        <div className="ml-auto w-8 h-3 skeleton rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-3 skeleton rounded" />
        <div className="w-3/4 h-3 skeleton rounded" />
      </div>
    </div>
  );
}

export default function CommentaryFeed({
  matchId,
  language,
  initialUpdates,
}: CommentaryFeedProps) {
  const [events, setEvents] = useState<SSECommentaryEvent[]>(initialUpdates);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setEvents(initialUpdates);
    setNewIds(new Set());

    if (!matchId) return;

    setIsLoading(true);
    setConnState('connecting');

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = `${base}/api/stream/${matchId}?lang=${language}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    let firstEvent = true;

    es.onopen = () => {
      setConnState('connected');
    };

    es.onmessage = (e: MessageEvent<string>) => {
      if (firstEvent) {
        firstEvent = false;
        setIsLoading(false);
      }
      try {
        const event = JSON.parse(e.data) as SSECommentaryEvent;
        if (!event.update?.id) return;
        setEvents((prev) => {
          const exists = prev.some((p) => p.update.id === event.update.id);
          if (exists) return prev;
          setNewIds((ids) => {
            const next = new Set(ids);
            next.add(event.update.id);
            return next;
          });
          return [event, ...prev];
        });
        setConnState('connected');
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnState('error');
      setIsLoading(false);
    };

    const loadingTimer = setTimeout(() => setIsLoading(false), 3000);

    return () => {
      es.close();
      eventSourceRef.current = null;
      clearTimeout(loadingTimer);
    };
  }, [matchId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <section className="py-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 text-text-muted animate-fade-in"
        role="status"
        aria-label="Waiting for match events"
      >
        <div className="w-16 h-16 rounded-full bg-bg-card border border-border-card flex items-center justify-center mb-4">
          <span className="text-2xl" aria-hidden="true">⏳</span>
        </div>
        <p className="text-sm font-medium text-text-secondary">Waiting for match events</p>
        <p className="text-xs mt-1">Commentary will appear here when the match starts</p>
      </div>
    );
  }

  return (
    <section aria-label="Live commentary feed" className="py-4">
      <ConnectionDot state={connState} />
      <ol className="list-none" aria-live="polite" aria-atomic="false">
        {events.map((event) => (
          <li key={event.update.id}>
            <CommentaryCard
              id={event.update.id}
              text={event.update.text}
              eventType={event.update.eventType}
              minute={event.update.minute}
              timestamp={event.update.timestamp}
              isSponsor={event.update.eventType === 'sponsor'}
              isNew={newIds.has(event.update.id)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
