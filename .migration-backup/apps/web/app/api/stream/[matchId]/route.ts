import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// SSE event format from backend-schema.md
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

interface CommentaryRow {
  id: string;
  content: string;
  event_type: string;
  event_minute: number | null;
  language: string;
  created_at: string;
}

function rowToSSEEvent(row: CommentaryRow): SSECommentaryEvent {
  return {
    type: 'commentary',
    update: {
      id: row.id,
      text: row.content,
      eventType: row.event_type,
      minute: row.event_minute,
      language: row.language,
      timestamp: row.created_at,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
): Promise<Response> {
  const { matchId } = params;
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') ?? 'hi';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Server configuration error', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string): void => {
        controller.enqueue(encoder.encode(data));
      };

      // 1. Fetch last 20 commentary_updates for this match + language (oldest first)
      const { data: history } = await supabase
        .from('commentary_updates')
        .select('id, content, event_type, event_minute, language, created_at')
        .eq('fixture_id', matchId)
        .eq('language', lang)
        .order('created_at', { ascending: true })
        .limit(20);

      if (history) {
        for (const row of history as CommentaryRow[]) {
          const event = rowToSSEEvent(row);
          send(`data: ${JSON.stringify(event)}\n\n`);
        }
      }

      // 2. Subscribe to Realtime inserts on commentary_updates
      const channel = supabase
        .channel(`commentary:${matchId}:${lang}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'commentary_updates',
            filter: `fixture_id=eq.${matchId}`,
          },
          (payload: { new: CommentaryRow }) => {
            const row = payload.new;
            // Only stream events matching the requested language
            if (row.language === lang) {
              const event = rowToSSEEvent(row);
              send(`data: ${JSON.stringify(event)}\n\n`);
            }
          }
        )
        .subscribe();

      // 3. Keepalive every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          send(': keepalive\n\n');
        } catch {
          clearInterval(keepaliveInterval);
        }
      }, 30_000);

      // Cleanup when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        void supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
