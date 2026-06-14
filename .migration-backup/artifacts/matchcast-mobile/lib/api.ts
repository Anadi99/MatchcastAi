const domain = process.env.EXPO_PUBLIC_DOMAIN;
export const API_BASE = domain ? `https://${domain}` : "http://localhost:8080";

export interface MatchData {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  kickoff_at: string;
}

export interface CommentaryUpdate {
  id: string;
  text: string;
  eventType: string;
  minute: number | null;
  language: string;
  timestamp: string;
}

export async function fetchMatches(): Promise<MatchData[]> {
  const res = await fetch(`${API_BASE}/api/matches`);
  if (!res.ok) throw new Error("Failed to fetch matches");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchCommentary(
  matchId: string,
  lang: string
): Promise<CommentaryUpdate[]> {
  const res = await fetch(
    `${API_BASE}/api/commentary/${matchId}?lang=${lang}&limit=30`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
