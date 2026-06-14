import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

function resolveSupabaseUrl(raw: string): string {
  // If it looks like a full API URL already, use as-is
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(raw)) return raw.replace(/\/$/, "");
  // Extract project ref from dashboard URLs like:
  //   https://supabase.com/dashboard/project/<ref>/...
  const match = raw.match(/\/project\/([a-z0-9]+)/i);
  if (match) return `https://${match[1]}.supabase.co`;
  return raw;
}

function getSupabase() {
  const rawUrl = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!rawUrl || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const url = resolveSupabaseUrl(rawUrl);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/matches — today's matches
router.get("/matches", async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("matches")
      .select("id, fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at")
      .in("status", ["live", "scheduled", "finished"])
      .gte("kickoff_at", startOfDay.toISOString())
      .lte("kickoff_at", endOfDay.toISOString())
      .order("kickoff_at", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// GET /api/stream/:matchId — SSE commentary stream
router.get("/stream/:matchId", async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const lang = (req.query["lang"] as string | undefined) ?? "hi";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: string) => {
    res.write(data);
  };

  try {
    const supabase = getSupabase();

    // Fetch initial history
    const { data: history } = await supabase
      .from("commentary_updates")
      .select("id, content, event_type, event_minute, language, created_at")
      .eq("fixture_id", matchId)
      .eq("language", lang)
      .order("created_at", { ascending: true })
      .limit(20);

    if (history) {
      for (const row of history) {
        const event = {
          type: "commentary",
          update: {
            id: row.id,
            text: row.content,
            eventType: row.event_type,
            minute: row.event_minute ?? null,
            language: row.language,
            timestamp: row.created_at,
          },
        };
        send(`data: ${JSON.stringify(event)}\n\n`);
      }
    }

    // Subscribe to realtime inserts
    const channel = supabase
      .channel(`commentary:${matchId}:${lang}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "commentary_updates",
          filter: `fixture_id=eq.${matchId}`,
        },
        // @ts-ignore — dynamic payload shape
        (payload) => {
          const row = payload.new;
          if (row.language === lang) {
            const event = {
              type: "commentary",
              update: {
                id: row.id,
                text: row.content,
                eventType: row.event_type,
                minute: row.event_minute ?? null,
                language: row.language,
                timestamp: row.created_at,
              },
            };
            try {
              send(`data: ${JSON.stringify(event)}\n\n`);
            } catch {
              // client disconnected
            }
          }
        }
      )
      .subscribe();

    const keepalive = setInterval(() => {
      try {
        send(": keepalive\n\n");
      } catch {
        clearInterval(keepalive);
      }
    }, 30_000);

    req.on("close", () => {
      clearInterval(keepalive);
      void supabase.removeChannel(channel);
      res.end();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    send(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// GET /api/commentary/:matchId — REST polling endpoint for mobile (additive)
router.get("/commentary/:matchId", async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const lang = (req.query["lang"] as string | undefined) ?? "hi";
  const limit = Math.min(parseInt((req.query["limit"] as string | undefined) ?? "30", 10), 50);

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("commentary_updates")
      .select("id, content, event_type, event_minute, language, created_at")
      .eq("fixture_id", matchId)
      .eq("language", lang)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const updates = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      text: row.content,
      eventType: row.event_type,
      minute: row.event_minute ?? null,
      language: row.language,
      timestamp: row.created_at,
    }));

    res.json(updates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
