import { createClient } from '@supabase/supabase-js';
import LivePage from './components/LivePage';

interface MatchRow {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  kickoff_at: string;
}

interface CommentaryRow {
  id: string;
  content: string;
  event_type: string;
  event_minute: number | null;
  language: string;
  created_at: string;
}

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
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured');
  }
  return createClient(url, key);
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

async function fetchTodayMatches(supabase: ReturnType<typeof createClient>): Promise<MatchRow[]> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('matches')
    .select('id, fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at')
    .in('status', ['live', 'scheduled', 'finished'])
    .gte('kickoff_at', startOfDay.toISOString())
    .lte('kickoff_at', endOfDay.toISOString())
    .order('kickoff_at', { ascending: true });

  if (error) {
    console.error('Error fetching matches:', error);
    return [];
  }

  return (data as MatchRow[]) ?? [];
}

async function fetchInitialCommentary(
  supabase: ReturnType<typeof createClient>,
  fixtureId: number,
  language: string
): Promise<SSECommentaryEvent[]> {
  const { data, error } = await supabase
    .from('commentary_updates')
    .select('id, content, event_type, event_minute, language, created_at')
    .eq('fixture_id', fixtureId)
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching commentary:', error);
    return [];
  }

  // Return in chronological order (oldest first) for display
  const rows = ((data as CommentaryRow[]) ?? []).reverse();
  return rows.map(rowToSSEEvent);
}

export default async function HomePage() {
  let matches: MatchRow[] = [];
  let initialUpdates: SSECommentaryEvent[] = [];

  try {
    const supabase = getSupabaseClient();

    // Fetch today's matches
    matches = await fetchTodayMatches(supabase);

    // Find the first live match, or fall back to the first match
    const firstLiveMatch = matches.find((m) => m.status === 'live') ?? matches[0];

    if (firstLiveMatch) {
      initialUpdates = await fetchInitialCommentary(
        supabase,
        firstLiveMatch.fixture_id,
        'hi'
      );
    }
  } catch (error) {
    console.error('Server-side data fetch failed:', error);
    // Render empty state — client will connect via SSE
  }

  const firstLiveMatch = matches.find((m) => m.status === 'live') ?? matches[0];

  return (
    <LivePage
      matches={matches}
      initialMatchId={firstLiveMatch?.id ?? ''}
      initialLanguage="hi"
      initialUpdates={initialUpdates}
    />
  );
}
