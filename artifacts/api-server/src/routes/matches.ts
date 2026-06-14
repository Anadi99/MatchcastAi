import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Demo data — World Cup 2026, shown when Supabase env vars are not set
// ---------------------------------------------------------------------------

const NOW = () => new Date().toISOString();
const minsAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const DEMO_MATCHES = [
  {
    id: "demo-match-1",
    fixture_id: 1001,
    home_team: "India",
    away_team: "Brazil",
    home_score: 1,
    away_score: 0,
    status: "live",
    kickoff_at: minsAgo(73),
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
    home_score: 2,
    away_score: 1,
    status: "finished",
    kickoff_at: minsAgo(200),
  },
];

type LangCommentary = Record<string, string[]>;

const DEMO_COMMENTARY: Record<string, LangCommentary> = {
  hi: {
    "demo-match-1": [
      "73वें मिनट में सुनील छेत्री ने अद्भुत गोल दागा! गेंद बाईं पोस्ट को छूते हुए जाल में समाई। पूरा स्टेडियम उत्साह से गूंज उठा! ⚽",
      "68वें मिनट में ब्राजील के नेमार ने शानदार फ्री-किक ली लेकिन भारतीय गोलकीपर गुरप्रीत ने अद्भुत बचाव किया। क्या रिफ्लेक्स था!",
      "60वां मिनट — भारत दबाव बना रहा है। अश्विन कुमार ने दाईं तरफ से ड्रिबल करते हुए ब्राजीली डिफेंस को चुनौती दी।",
      "46वां मिनट — दूसरा हाफ शुरू! दोनों टीमें मैदान पर उतर चुकी हैं। भारत के लिए यह ऐतिहासिक क्वार्टर फाइनल मुकाबला है।",
      "45वां मिनट + 3 — हाफ टाइम! पहले हाफ में दोनों टीमें बराबर। भारत ने रक्षात्मक रणनीति से ब्राजील को रोका। 🔔",
      "22वां मिनट — ब्राजील का कॉर्नर किक! विनीसियस जूनियर ने हेडर लगाया लेकिन गेंद बार से टकराकर बाहर गई।",
      "1वां मिनट — किकऑफ! FIFA विश्व कप 2026 का क्वार्टर फाइनल शुरू। India 🇮🇳 vs Brazil 🇧🇷 — मुंबई के DY पाटिल स्टेडियम में। 🏁",
    ],
    "demo-match-3": [
      "मेसी का दूसरा गोल! 88वें मिनट में अर्जेंटीना ने मैच जीत लिया। जर्मनी 2-1 से हारा। 🏆",
      "मेसी ने पेनल्टी गोल किया — 68वें मिनट। अर्जेंटीना आगे 1-0।",
      "जर्मनी का गोल! 45वें मिनट में मुलर ने बराबरी कराई — 1-1।",
      "अर्जेंटीना का गोल! 12वें मिनट में डि मारिया ने पहला गोल — 1-0।",
    ],
  },
  ta: {
    "demo-match-1": [
      "73வது நிமிடம்! சுனீல் சேத்ரி அற்புதமான கோல் அடித்தார்! பந்து இடது கோல்போஸ்டை தொட்டு வலையில் சிக்கியது! இந்திய ரசிகர்கள் கூச்சலிட்டனர்! ⚽",
      "68வது நிமிடம் — நெய்மார் சுதந்திர கிக் எடுத்தார், ஆனால் இந்திய கீப்பர் குர்பிரீத் அதிரடி காப்பு காட்டினார்! அற்புதமான ரிஃப்ளக்ஸ்!",
      "60வது நிமிடம் — இந்தியா தாக்குதல் தீவிரமடைகிறது. அஷ்வின் குமார் வலது பக்கம் டிரிபிள் செய்து பிரேசில் பாதுகாப்பை சவாலுக்கு உட்படுத்தினார்.",
      "46வது நிமிடம் — இரண்டாம் பாதி தொடங்கியது! இரு அணிகளும் மீண்டும் களத்தில். இந்தியாவிற்கு இது வரலாற்றுசிறப்பு மிக்க காலிறுதி போட்டி.",
      "45+3வது நிமிடம் — இடைவேளை! முதல் பாதி சமநிலையில் முடிந்தது. இந்தியா தடுப்பாட்டத்தில் சிறந்து விளங்கியது. 🔔",
      "22வது நிமிடம் — பிரேசிலுக்கு கார்னர் கிக். வினீசியஸ் தலையில் அடித்தார், பந்து கிராஸ்பார் தொட்டு வெளியேறியது.",
      "1வது நிமிடம் — கிக்ஆஃப்! FIFA உலகக்கிண்ணம் 2026 காலிறுதி. India 🇮🇳 vs Brazil 🇧🇷 — மும்பையில் DY பாட்டீல் ஸ்டேடியம். 🏁",
    ],
    "demo-match-3": [
      "மெஸ்ஸி இரண்டாவது கோல்! 88வது நிமிடம் — அர்ஜென்டினா வெற்றி 2-1. ஜெர்மனி தோல்வி. 🏆",
      "மெஸ்ஸி பெனால்டி கோல் — 68வது நிமிடம். அர்ஜென்டினா 1-0 முன்னிலை.",
      "ஜெர்மனியின் கோல்! 45வது நிமிடம் முல்லர் சமன் செய்தார் — 1-1.",
      "அர்ஜென்டினாவின் கோல்! 12வது நிமிடம் டி மாரியா முதல் கோல் — 1-0.",
    ],
  },
  te: {
    "demo-match-1": [
      "73వ నిమిషం! సునీల్ చెత్రి అద్భుతమైన గోల్ చేశాడు! బంతి ఎడమ పోస్ట్‌ని తాకి వలలో చేరింది! స్టేడియం హర్షోల్లాసంతో నిండిపోయింది! ⚽",
      "68వ నిమిషం — నెయిమార్ ఫ్రీ కిక్ తీసుకున్నాడు, కానీ భారత గోల్‌కీపర్ గుర్‌ప్రీత్ అద్భుతమైన సేవ్ చేశాడు! అద్భుత రిఫ్లెక్స్!",
      "60వ నిమిషం — భారత్ దాడి తీవ్రతరమవుతోంది. అశ్విన్ కుమార్ కుడి వైపు డ్రిబుల్ చేసి బ్రెజిల్ డిఫెన్స్‌ను సవాలు చేశాడు.",
      "46వ నిమిషం — రెండవ సగం ప్రారంభం! రెండు జట్లూ మైదానంలోకి వచ్చాయి. భారత్‌కు ఇది చారిత్రాత్మక క్వార్టర్ ఫైనల్.",
      "45+3 నిమిషం — హాఫ్ టైమ్! మొదటి సగం సమానంగా ముగిసింది. భారత్ రక్షణలో రాణించింది. 🔔",
      "22వ నిమిషం — బ్రెజిల్ కార్నర్ కిక్. వినీషియస్ హెడర్ చేశాడు, బంతి క్రాస్‌బార్ తాకి బయటకు వెళ్ళింది.",
      "1వ నిమిషం — కిక్‌ఆఫ్! FIFA వరల్డ్ కప్ 2026 క్వార్టర్ ఫైనల్. India 🇮🇳 vs Brazil 🇧🇷 — ముంబైలో DY పాటిల్ స్టేడియం. 🏁",
    ],
    "demo-match-3": [
      "మెస్సీ రెండవ గోల్! 88వ నిమిషం — అర్జెంటీనా 2-1 గెలిచింది. జర్మనీ ఓడిపోయింది. 🏆",
      "మెస్సీ పెనాల్టీ గోల్ — 68వ నిమిషం. అర్జెంటీనా 1-0 ముందు.",
      "జర్మనీ గోల్! 45వ నిమిషం మల్లర్ సమానం చేశాడు — 1-1.",
      "అర్జెంటీనా గోల్! 12వ నిమిషం డి మారియా మొదటి గోల్ — 1-0.",
    ],
  },
  mr: {
    "demo-match-1": [
      "73व्या मिनिटाला सुनील छेत्रीने अप्रतिम गोल केला! चेंडू डाव्या पोस्टला स्पर्श करत जाळ्यात शिरला! स्टेडियम जल्लोषाने भरून गेलं! ⚽",
      "68वे मिनिट — नेमारने फ्री किक घेतली, पण भारतीय गोलकीपर गुरप्रीतने अफलातून बचाव केला! काय रिफ्लेक्स होते!",
      "60वे मिनिट — भारत आक्रमण तीव्र करत आहे. अश्विन कुमारने उजव्या बाजूने ड्रिबल करत ब्राझीलच्या बचावाला आव्हान दिले.",
      "46वे मिनिट — दुसरा हाफ सुरू! दोन्ही संघ मैदानावर. भारतासाठी हा ऐतिहासिक उपांत्यपूर्व सामना आहे.",
      "45+3 मिनिट — हाफ टाइम! पहिला अर्धा सामना बरोबरीत संपला. भारताने बचावात उत्तम खेळ केला. 🔔",
      "22वे मिनिट — ब्राझीलचा कॉर्नर किक! विनीसियसने हेड केला, पण चेंडू क्रॉसबारला लागून बाहेर गेला.",
      "1ले मिनिट — किकऑफ! FIFA विश्वचषक 2026 उपांत्यपूर्व फेरी. India 🇮🇳 vs Brazil 🇧🇷 — मुंबईत DY पाटील स्टेडियम. 🏁",
    ],
    "demo-match-3": [
      "मेस्सीचा दुसरा गोल! 88वे मिनिट — अर्जेंटिना विजयी 2-1. जर्मनी पराभूत. 🏆",
      "मेस्सीचा पेनल्टी गोल — 68वे मिनिट. अर्जेंटिना 1-0 पुढे.",
      "जर्मनीचा गोल! 45वे मिनिट म्युलरने बरोबरी साधली — 1-1.",
      "अर्जेंटिनाचा गोल! 12वे मिनिट डि मारियाने पहिला गोल — 1-0.",
    ],
  },
};

const LIVE_STREAM_LINES: Record<string, Record<string, { text: string; eventType: string; minute: number | null }[]>> = {
  hi: {
    "demo-match-1": [
      { text: "74वां मिनट — ब्राजील का खतरनाक हमला! राफिन्हा ने पेनल्टी बॉक्स में घुसकर शॉट लगाया लेकिन गुरप्रीत ने गेंद को कॉर्नर में धकेल दिया।", eventType: "commentary", minute: 74 },
      { text: "75वां मिनट — भारत का काउंटर अटैक! छेत्री ने गेंद आगे बढ़ाई, अश्विन ने शॉट लगाया — पोस्ट से चूका! क्या मौका था!", eventType: "commentary", minute: 75 },
      { text: "76वां मिनट — VAR की जांच! ब्राजील ने पेनल्टी के लिए अपील की। रेफरी मॉनिटर देख रहे हैं…", eventType: "commentary", minute: 76 },
      { text: "78वां मिनट — कोई पेनल्टी नहीं! VAR ने क्लियर किया। भारत की रक्षा सही थी। स्टेडियम में जय हिंद के नारे गूंज रहे हैं!", eventType: "commentary", minute: 78 },
      { text: "80वां मिनट — ब्राजील का 4-3-3 फॉर्मेशन दबाव बना रहा है। नेमार और विनीसियस का कॉम्बिनेशन खतरनाक है।", eventType: "commentary", minute: 80 },
    ],
  },
  ta: {
    "demo-match-1": [
      { text: "74வது நிமிடம் — பிரேசிலின் ஆபத்தான தாக்குதல்! ரஃபினா பெனால்டி பகுதியில் நுழைந்து சுட்டார், ஆனால் குர்பிரீத் கார்னருக்கு தள்ளினார்.", eventType: "commentary", minute: 74 },
      { text: "75வது நிமிடம் — இந்தியாவின் எதிர்த் தாக்குதல்! சேத்ரி பந்தை முன்னுக்கு அனுப்பினார், அஷ்வின் சுட்டார் — கோல்போஸ்ட் தவறியது! என்ன வாய்ப்பு!", eventType: "commentary", minute: 75 },
      { text: "76வது நிமிடம் — VAR ஆய்வு! பிரேசில் பெனால்டிக்காக கோரியது. நடுவர் மானிட்டரை பார்க்கிறார்…", eventType: "commentary", minute: 76 },
      { text: "78வது நிமிடம் — பெனால்டி இல்லை! VAR தெளிவுபடுத்தியது. இந்திய பாதுகாப்பு சரியானது. ஸ்டேடியத்தில் 'ஜய் ஹிந்த்' முழக்கங்கள்!", eventType: "commentary", minute: 78 },
    ],
  },
  te: {
    "demo-match-1": [
      { text: "74వ నిమిషం — బ్రెజిల్ ప్రమాదకర దాడి! రఫీన్హా పెనాల్టీ బాక్స్‌లోకి చొచ్చుకొని షాట్ తీశాడు, కానీ గుర్‌ప్రీత్ కార్నర్‌కు నెట్టాడు.", eventType: "commentary", minute: 74 },
      { text: "75వ నిమిషం — భారత్ కౌంటర్ అటాక్! చెత్రి బంతిని ముందుకు పాస్ చేశాడు, అశ్విన్ షాట్ తీశాడు — పోస్ట్ తప్పింది! ఏం అవకాశం!", eventType: "commentary", minute: 75 },
      { text: "76వ నిమిషం — VAR తనిఖీ! బ్రెజిల్ పెనాల్టీ కోసం అభ్యర్థించింది. రిఫరీ మానిటర్ చూస్తున్నాడు…", eventType: "commentary", minute: 76 },
      { text: "78వ నిమిషం — పెనాల్టీ లేదు! VAR క్లియర్ చేసింది. భారత్ రక్షణ సరైనది. స్టేడియంలో జై హింద్ నినాదాలు!", eventType: "commentary", minute: 78 },
    ],
  },
  mr: {
    "demo-match-1": [
      { text: "74वे मिनिट — ब्राझीलचा धोकादायक हल्ला! राफिन्हाने पेनल्टी बॉक्समध्ये शिरून शॉट मारला, पण गुरप्रीतने कॉर्नरमध्ये ढकलले.", eventType: "commentary", minute: 74 },
      { text: "75वे मिनिट — भारताचा काउंटर अटॅक! छेत्रीने चेंडू पुढे ढकलला, अश्विनने शॉट मारला — पोस्टने चुकला! काय संधी!", eventType: "commentary", minute: 75 },
      { text: "76वे मिनिट — VAR तपासणी! ब्राझीलने पेनल्टीसाठी आव्हान केले. पंच मॉनिटर पाहत आहेत…", eventType: "commentary", minute: 76 },
      { text: "78वे मिनिट — पेनल्टी नाही! VAR ने स्पष्ट केले. भारताचा बचाव योग्य होता. स्टेडियममध्ये जय हिंद च्या घोषणा!", eventType: "commentary", minute: 78 },
    ],
  },
};

function isDemoMode(): boolean {
  const url = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  return !url || !key;
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/matches
router.get("/matches", async (_req: Request, res: Response) => {
  if (isDemoMode()) {
    // Refresh timestamps so "live" match always looks current
    const now = Date.now();
    const live = { ...DEMO_MATCHES[0], kickoff_at: new Date(now - 73 * 60_000).toISOString() };
    return res.json([live, ...DEMO_MATCHES.slice(1)]);
  }

  try {
    const supabase = getSupabase();
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("matches")
      .select("id, fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at")
      .in("status", ["live", "scheduled", "finished"])
      .gte("kickoff_at", startOfDay.toISOString())
      .lte("kickoff_at", endOfDay.toISOString())
      .order("kickoff_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
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

  const send = (data: string) => { try { res.write(data); } catch { /* client gone */ } };

  if (isDemoMode()) {
    const history = (DEMO_COMMENTARY[lang]?.[matchId] ?? DEMO_COMMENTARY["hi"][matchId] ?? []);
    let counter = history.length;

    // Send history in reverse (oldest first)
    for (let i = history.length - 1; i >= 0; i--) {
      const text = history[i];
      send(`data: ${JSON.stringify({
        type: "commentary",
        update: {
          id: `demo-${matchId}-${lang}-${i}`,
          text,
          eventType: i === 0 ? "goal" : i === history.length - 1 ? "kickoff" : i === Math.floor(history.length / 2) ? "half_time" : "commentary",
          minute: i === 0 ? 73 : i === history.length - 1 ? 1 : null,
          language: lang,
          timestamp: new Date(Date.now() - (i + 1) * 3 * 60_000).toISOString(),
        },
      })}\n\n`);
    }

    if (matchId !== "demo-match-1") {
      res.end();
      return;
    }

    // For live match: drip-feed new commentary lines every 10 seconds
    const streamLines = LIVE_STREAM_LINES[lang]?.["demo-match-1"] ?? LIVE_STREAM_LINES["hi"]["demo-match-1"];
    let streamIdx = 0;

    const interval = setInterval(() => {
      if (streamIdx >= streamLines.length) {
        // Cycle back to start with updated minute
        streamIdx = 0;
        counter += streamLines.length;
      }
      const line = streamLines[streamIdx++];
      send(`data: ${JSON.stringify({
        type: "commentary",
        update: {
          id: `demo-live-${lang}-${counter++}-${Date.now()}`,
          text: line.text,
          eventType: line.eventType,
          minute: line.minute,
          language: lang,
          timestamp: NOW(),
        },
      })}\n\n`);
    }, 10_000);

    const keepalive = setInterval(() => send(": keepalive\n\n"), 30_000);

    req.on("close", () => {
      clearInterval(interval);
      clearInterval(keepalive);
      res.end();
    });
    return;
  }

  // --- Supabase path ---
  try {
    const supabase = getSupabase();

    const { data: history } = await supabase
      .from("commentary_updates")
      .select("id, content, event_type, event_minute, language, created_at")
      .eq("fixture_id", matchId)
      .eq("language", lang)
      .order("created_at", { ascending: true })
      .limit(20);

    if (history) {
      for (const row of history) {
        send(`data: ${JSON.stringify({
          type: "commentary",
          update: {
            id: row.id,
            text: row.content,
            eventType: row.event_type,
            minute: row.event_minute ?? null,
            language: row.language,
            timestamp: row.created_at,
          },
        })}\n\n`);
      }
    }

    const channel = supabase
      .channel(`commentary:${matchId}:${lang}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commentary_updates", filter: `fixture_id=eq.${matchId}` },
        // @ts-ignore
        (payload) => {
          const row = payload.new;
          if (row.language === lang) {
            send(`data: ${JSON.stringify({
              type: "commentary",
              update: {
                id: row.id,
                text: row.content,
                eventType: row.event_type,
                minute: row.event_minute ?? null,
                language: row.language,
                timestamp: row.created_at,
              },
            })}\n\n`);
          }
        }
      )
      .subscribe();

    const keepalive = setInterval(() => send(": keepalive\n\n"), 30_000);
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

// GET /api/commentary/:matchId — REST polling for mobile
router.get("/commentary/:matchId", async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const lang = (req.query["lang"] as string | undefined) ?? "hi";
  const limit = Math.min(parseInt((req.query["limit"] as string | undefined) ?? "30", 10), 50);

  if (isDemoMode()) {
    const history = (DEMO_COMMENTARY[lang]?.[matchId] ?? DEMO_COMMENTARY["hi"][matchId] ?? []);
    const updates = history.slice(0, limit).map((text, i) => ({
      id: `demo-${matchId}-${lang}-${i}`,
      text,
      eventType: i === 0 ? "goal" : i === history.length - 1 ? "kickoff" : i === Math.floor(history.length / 2) ? "half_time" : "commentary",
      minute: i === 0 ? 73 : i === history.length - 1 ? 1 : null,
      language: lang,
      timestamp: new Date(Date.now() - (i + 1) * 3 * 60_000).toISOString(),
    }));
    return res.json(updates);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("commentary_updates")
      .select("id, content, event_type, event_minute, language, created_at")
      .eq("fixture_id", matchId)
      .eq("language", lang)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const updates = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      text: row.content,
      eventType: row.event_type,
      minute: row.event_minute ?? null,
      language: row.language,
      timestamp: row.created_at,
    }));
    return res.json(updates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

// GET /api/demo — indicates demo mode status
router.get("/demo", (_req: Request, res: Response) => {
  res.json({ demo: isDemoMode() });
});

export default router;
