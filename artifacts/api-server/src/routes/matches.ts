import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  getRelevantMatches,
  getMatchById,
  getCommentary,
  pickTemplateSet,
} from "../worldcup-api.js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Fallback demo data — only used when WC26 API AND Supabase are both offline
// ---------------------------------------------------------------------------

const minsAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const DEMO_MATCHES = [
  {
    id: "demo-match-1",
    fixture_id: 1001,
    home_team: "Mexico",
    away_team: "South Africa",
    home_score: 2,
    away_score: 0,
    status: "finished",
    kickoff_at: minsAgo(200),
  },
  {
    id: "demo-match-2",
    fixture_id: 1002,
    home_team: "France",
    away_team: "England",
    home_score: 0,
    away_score: 0,
    status: "scheduled",
    kickoff_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
  },
  {
    id: "demo-match-3",
    fixture_id: 1003,
    home_team: "Argentina",
    away_team: "Germany",
    home_score: 1,
    away_score: 0,
    status: "live",
    kickoff_at: minsAgo(73),
  },
];

type LangCommentary = Record<string, string[]>;

const DEMO_COMMENTARY: Record<string, LangCommentary> = {
  hi: {
    "demo-match-1": [
      "90वां मिनट — सामना खत्म! Mexico ने South Africa को 2-0 से हराया। शानदार प्रदर्शन।",
      "67वें मिनट में Mexico का दूसरा गोल! बेहतरीन काउंटर अटैक।",
      "9वें मिनट में Mexico ने पहले गोल से बढ़त ली। स्टेडियम में जश्न का माहौल।",
      "1वां मिनट — किकऑफ! FIFA विश्व कप 2026 ग्रुप A का पहला मैच।",
    ],
    "demo-match-3": [
      "73वें मिनट में Argentina का गोल! 1-0 से आगे। जोरदार फिनिश।",
      "45+2 — हाफ टाइम! दोनों टीमें बराबर। Argentina दबाव बना रहा था।",
      "1वां मिनट — किकऑफ! Argentina vs Germany — एक क्लासिक विश्व कप मुकाबला।",
    ],
  },
  ta: {
    "demo-match-1": [
      "90வது நிமிடம் — போட்டி முடிந்தது! Mexico South Africa-ஐ 2-0 தோற்கடித்தது.",
      "67வது நிமிடம் — Mexico இரண்டாவது கோல். சிறப்பான கவுண்டர் அட்டாக்.",
      "9வது நிமிடம் — Mexico முதல் கோல் அடித்தது. ஸ்டேடியம் கொண்டாட்டம்.",
      "1வது நிமிடம் — கிக்ஆஃப்! FIFA உலகக்கிண்ணம் 2026 குழு A முதல் போட்டி.",
    ],
    "demo-match-3": [
      "73வது நிமிடம் — Argentina கோல்! 1-0 முன்னிலை.",
      "45+2 — இடைவேளை! இரு அணிகளும் சமம். Argentina அழுத்தம் கொடுத்தது.",
      "1வது நிமிடம் — கிக்ஆஃப்! Argentina vs Germany — ஒரு கிளாசிக் போட்டி.",
    ],
  },
  te: {
    "demo-match-1": [
      "90వ నిమిషం — మ్యాచ్ ముగిసింది! Mexico South Africa-ను 2-0తో ఓడించింది.",
      "67వ నిమిషం — Mexico రెండవ గోల్. అద్భుతమైన కౌంటర్ అటాక్.",
      "9వ నిమిషం — Mexico మొదటి గోల్ చేసింది. స్టేడియం సంబరాల్లో మునిగింది.",
      "1వ నిమిషం — కిక్‌ఆఫ్! FIFA వరల్డ్ కప్ 2026 గ్రూప్ A మొదటి మ్యాచ్.",
    ],
    "demo-match-3": [
      "73వ నిమిషం — Argentina గోల్! 1-0 ముందుంది.",
      "45+2 — హాఫ్ టైమ్! రెండు జట్లూ సమానం. Argentina ఒత్తిడి తెచ్చింది.",
      "1వ నిమిషం — కిక్‌ఆఫ్! Argentina vs Germany — ఒక క్లాసిక్ మ్యాచ్.",
    ],
  },
  mr: {
    "demo-match-1": [
      "90वे मिनिट — सामना संपला! Mexico ने South Africa ला 2-0 ने हरवले.",
      "67वे मिनिट — Mexico चा दुसरा गोल. अफलातून काउंटर अटॅक.",
      "9वे मिनिट — Mexico ने पहिला गोल केला. स्टेडियम जल्लोषाने भरले.",
      "1ले मिनिट — किकऑफ! FIFA विश्वचषक 2026 गट A पहिला सामना.",
    ],
    "demo-match-3": [
      "73वे मिनिट — Argentina चा गोल! 1-0 पुढे.",
      "45+2 — हाफ टाइम! दोन्ही संघ बरोबर. Argentina दबाव आणत होते.",
      "1ले मिनिट — किकऑफ! Argentina vs Germany — एक क्लासिक सामना.",
    ],
  },
};

const LIVE_STREAM_LINES: Record<string, { text: string; eventType: string; minute: number | null }[]> = {
  hi: [
    { text: "74वां मिनट — खतरनाक हमला! गोलकीपर ने कॉर्नर में धकेला।", eventType: "commentary", minute: 74 },
    { text: "75वां मिनट — काउंटर अटैक! शॉट लगाया — पोस्ट से चूका!", eventType: "commentary", minute: 75 },
    { text: "76वां मिनट — VAR की जांच! रेफरी मॉनिटर देख रहे हैं…", eventType: "var", minute: 76 },
    { text: "78वां मिनट — कोई पेनल्टी नहीं! VAR ने क्लियर किया। जोरदार बचाव।", eventType: "commentary", minute: 78 },
    { text: "82वां मिनट — दोनों टीमें जीत के लिए दबाव बना रही हैं।", eventType: "commentary", minute: 82 },
  ],
  ta: [
    { text: "74வது நிமிடம் — ஆபத்தான தாக்குதல்! கீப்பர் கார்னருக்கு தள்ளினார்.", eventType: "commentary", minute: 74 },
    { text: "75வது நிமிடம் — எதிர்த் தாக்குதல்! சுட்டார் — கோல்போஸ்ட் தவறியது!", eventType: "commentary", minute: 75 },
    { text: "76வது நிமிடம் — VAR ஆய்வு! நடுவர் மானிட்டரை பார்க்கிறார்.", eventType: "var", minute: 76 },
    { text: "78வது நிமிடம் — பெனால்டி இல்லை! VAR தெளிவுபடுத்தியது.", eventType: "commentary", minute: 78 },
    { text: "82வது நிமிடம் — இரு அணிகளும் வெற்றிக்கு முயற்சிக்கின்றன.", eventType: "commentary", minute: 82 },
  ],
  te: [
    { text: "74వ నిమిషం — ప్రమాదకర దాడి! కీపర్ కార్నర్‌కు నెట్టాడు.", eventType: "commentary", minute: 74 },
    { text: "75వ నిమిషం — కౌంటర్! షాట్ — పోస్ట్ తప్పింది!", eventType: "commentary", minute: 75 },
    { text: "76వ నిమిషం — VAR తనిఖీ! రిఫరీ మానిటర్ చూస్తున్నాడు.", eventType: "var", minute: 76 },
    { text: "78వ నిమిషం — పెనాల్టీ లేదు! VAR క్లియర్ చేసింది.", eventType: "commentary", minute: 78 },
    { text: "82వ నిమిషం — రెండు జట్లూ గెలుపు కోసం పోరాడుతున్నాయి.", eventType: "commentary", minute: 82 },
  ],
  mr: [
    { text: "74वे मिनिट — धोकादायक हल्ला! कीपरने कॉर्नरमध्ये ढकलले.", eventType: "commentary", minute: 74 },
    { text: "75वे मिनिट — काउंटर! शॉट — पोस्टने चुकला!", eventType: "commentary", minute: 75 },
    { text: "76वे मिनिट — VAR तपासणी! पंच मॉनिटर पाहत आहेत.", eventType: "var", minute: 76 },
    { text: "78वे मिनिट — पेनल्टी नाही! VAR ने स्पष्ट केले.", eventType: "commentary", minute: 78 },
    { text: "82वे मिनिट — दोन्ही संघ विजयासाठी झुंजत आहेत.", eventType: "commentary", minute: 82 },
  ],
};

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

function hasSupabase(): boolean {
  const url = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  return !!(url && key);
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function resolveSupabaseUrl(raw: string): string {
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(raw)) return raw.replace(/\/$/, "");
  const match = raw.match(/\/project\/([a-z0-9]+)/i);
  if (match) return `https://${match[1]}.supabase.co`;
  return raw;
}

function getSupabase() {
  const rawUrl = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!rawUrl || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const url = resolveSupabaseUrl(rawUrl);
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const NOW = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/matches
router.get("/matches", async (_req: Request, res: Response) => {
  // 1. Supabase (production path)
  if (hasSupabase()) {
    try {
      const supabase = getSupabase();
      const today = new Date();
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      const end   = new Date(today); end.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("matches")
        .select("id, fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at")
        .in("status", ["live", "scheduled", "finished"])
        .gte("kickoff_at", start.toISOString())
        .lte("kickoff_at", end.toISOString())
        .order("kickoff_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ error: msg });
    }
  }

  // 2. WC26 API (real match data, no Supabase needed)
  try {
    const matches = await getRelevantMatches();
    return res.json(matches);
  } catch {
    // 3. Offline fallback
    const now = Date.now();
    const live = { ...DEMO_MATCHES[2], kickoff_at: new Date(now - 73 * 60_000).toISOString() };
    return res.json([...DEMO_MATCHES.slice(0, 2), live]);
  }
});

// GET /api/stream/:matchId — SSE commentary stream
router.get("/stream/:matchId", async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const lang = (req.query["lang"] as string) || "hi";
  const validLang = ["hi", "ta", "te", "mr"].includes(lang) ? lang : "hi";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: string) => { try { res.write(data); } catch { /* client gone */ } };
  const sendEvent = (id: string, text: string, eventType: string, minute: number | null, timestamp: string) =>
    send(`data: ${JSON.stringify({ type: "commentary", update: { id, text, eventType, minute, language: validLang, timestamp } })}\n\n`);

  // --- Supabase path ---
  if (hasSupabase()) {
    try {
      const supabase = getSupabase();
      const { data: history } = await supabase
        .from("commentary_updates")
        .select("id, content, event_type, event_minute, language, created_at")
        .eq("fixture_id", matchId)
        .eq("language", validLang)
        .order("created_at", { ascending: true })
        .limit(20);

      if (history) {
        for (const row of history) {
          sendEvent(row.id, row.content, row.event_type, row.event_minute ?? null, row.created_at);
        }
      }

      const channel = supabase
        .channel(`commentary:${matchId}:${validLang}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "commentary_updates", filter: `fixture_id=eq.${matchId}` },
          // @ts-ignore
          (payload) => {
            const row = payload.new;
            if (row.language === validLang) {
              sendEvent(row.id, row.content, row.event_type, row.event_minute ?? null, row.created_at);
            }
          }
        )
        .subscribe();

      const keepalive = setInterval(() => send(": keepalive\n\n"), 30_000);
      req.on("close", () => { clearInterval(keepalive); void supabase.removeChannel(channel); res.end(); });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      send(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
    return;
  }

  // --- WC26 API path (real match, templated commentary) ---
  if (matchId.startsWith("wc26-")) {
    let homeTeam = "Home";
    let awayTeam = "Away";
    let isFinished = false;
    let homeScore = 0;
    let awayScore = 0;

    try {
      const match = await getMatchById(matchId);
      if (match) {
        homeTeam = match.home_team;
        awayTeam = match.away_team;
        isFinished = match.status === "finished";
        homeScore = match.home_score;
        awayScore = match.away_score;
      }
    } catch { /* use defaults */ }

    const tplSet = pickTemplateSet(homeScore, awayScore);
    const lines = getCommentary(validLang, homeTeam, awayTeam, tplSet);

    // Send history (reversed = oldest first → newest last)
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      sendEvent(
        `wc26-${matchId}-${validLang}-${i}`,
        l.text, l.eventType, l.minute,
        new Date(Date.now() - (i + 1) * 8 * 60_000).toISOString()
      );
    }

    if (isFinished) {
      res.end();
      return;
    }

    // Live / scheduled: drip-feed generic lines every 10 seconds
    const liveLines = LIVE_STREAM_LINES[validLang] ?? LIVE_STREAM_LINES["hi"];
    let streamIdx = 0;
    let counter = lines.length;

    const interval = setInterval(() => {
      if (streamIdx >= liveLines.length) streamIdx = 0;
      const l = liveLines[streamIdx++];
      const text = l.text
        .replace(/\{home\}/g, homeTeam)
        .replace(/\{away\}/g, awayTeam);
      sendEvent(`wc26-live-${validLang}-${counter++}-${Date.now()}`, text, l.eventType, l.minute, NOW());
    }, 10_000);

    const keepalive = setInterval(() => send(": keepalive\n\n"), 30_000);
    req.on("close", () => { clearInterval(interval); clearInterval(keepalive); res.end(); });
    return;
  }

  // --- Fallback demo path ---
  const history = (DEMO_COMMENTARY[validLang]?.[matchId] ?? DEMO_COMMENTARY["hi"]?.[matchId] ?? []);
  let counter = history.length;

  for (let i = history.length - 1; i >= 0; i--) {
    sendEvent(
      `demo-${matchId}-${validLang}-${i}`,
      history[i],
      i === 0 ? "full_time" : i === history.length - 1 ? "kickoff" : "commentary",
      null,
      new Date(Date.now() - (i + 1) * 3 * 60_000).toISOString()
    );
  }

  if (matchId !== "demo-match-3") {
    res.end();
    return;
  }

  // Live demo match drip-feed
  const liveLines = LIVE_STREAM_LINES[validLang] ?? LIVE_STREAM_LINES["hi"];
  let streamIdx = 0;
  const interval = setInterval(() => {
    if (streamIdx >= liveLines.length) { streamIdx = 0; counter += liveLines.length; }
    const l = liveLines[streamIdx++];
    sendEvent(`demo-live-${validLang}-${counter++}-${Date.now()}`, l.text, l.eventType, l.minute, NOW());
  }, 10_000);

  const keepalive = setInterval(() => send(": keepalive\n\n"), 30_000);
  req.on("close", () => { clearInterval(interval); clearInterval(keepalive); res.end(); });
});

// GET /api/commentary/:matchId — REST polling for mobile
router.get("/commentary/:matchId", async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const lang = (req.query["lang"] as string) || "hi";
  const validLang = ["hi", "ta", "te", "mr"].includes(lang) ? lang : "hi";
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "30", 10), 50);

  if (hasSupabase()) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("commentary_updates")
        .select("id, content, event_type, event_minute, language, created_at")
        .eq("fixture_id", matchId)
        .eq("language", validLang)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return res.status(500).json({ error: error.message });
      return res.json((data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id, text: row.content, eventType: row.event_type,
        minute: row.event_minute ?? null, language: row.language, timestamp: row.created_at,
      })));
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // WC26 path
  if (matchId.startsWith("wc26-")) {
    let homeTeam = "Home";
    let awayTeam = "Away";
    let homeScore = 0;
    let awayScore = 0;
    try {
      const match = await getMatchById(matchId);
      if (match) { homeTeam = match.home_team; awayTeam = match.away_team; homeScore = match.home_score; awayScore = match.away_score; }
    } catch { /* defaults */ }

    const lines = getCommentary(validLang, homeTeam, awayTeam, pickTemplateSet(homeScore, awayScore));
    return res.json(lines.slice(0, limit).map((l, i) => ({
      id: `wc26-${matchId}-${validLang}-${i}`,
      text: l.text, eventType: l.eventType, minute: l.minute, language: validLang,
      timestamp: new Date(Date.now() - (i + 1) * 8 * 60_000).toISOString(),
    })));
  }

  // Fallback demo
  const history = (DEMO_COMMENTARY[validLang]?.[matchId] ?? DEMO_COMMENTARY["hi"]?.[matchId] ?? []);
  return res.json(history.slice(0, limit).map((text, i) => ({
    id: `demo-${matchId}-${validLang}-${i}`,
    text,
    eventType: i === 0 ? "full_time" : i === history.length - 1 ? "kickoff" : "commentary",
    minute: null,
    language: validLang,
    timestamp: new Date(Date.now() - (i + 1) * 3 * 60_000).toISOString(),
  })));
});

// GET /api/demo — mode indicator
router.get("/demo", (_req: Request, res: Response) => {
  res.json({ demo: !hasSupabase() });
});

export default router;
