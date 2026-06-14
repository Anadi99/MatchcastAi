'use client';

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
  score?: {
    home: number;
    away: number;
  };
}

interface CommentaryFeedProps {
  matchId: string;
  language: string;
  initialUpdates: SSECommentaryEvent[];
}

export default function CommentaryFeed({
  matchId,
  language,
  initialUpdates,
}: CommentaryFeedProps) {
  const [events, setEvents] = useState<SSECommentaryEvent[]>(initialUpdates);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Close any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset to initial updates when match or language changes
    setEvents(initialUpdates);

    const url = `/api/stream/${matchId}?lang=${language}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SSECommentaryEvent;
        setEvents((prev) => {
          // Avoid duplicates (initial fetch + realtime overlap)
          const exists = prev.some((p) => p.update.id === event.update.id);
          if (exists) return prev;
          // Prepend newest events to the top
          return [event, ...prev];
        });
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error; nothing to do here
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [matchId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-text-muted"
        role="status"
        aria-label="No commentary available"
      >
        <span className="text-4xl mb-3" aria-hidden="true">
          ⏳
        </span>
        <p className="text-sm">Waiting for match events…</p>
      </div>
    );
  }

  return (
    <section aria-label="Live commentary feed" className="py-4">
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
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
