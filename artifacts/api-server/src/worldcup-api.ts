// ---------------------------------------------------------------------------
// FIFA World Cup 2026 API integration
// Source: https://worldcup26.ir  — public read, no auth required
// ---------------------------------------------------------------------------

const WC26_BASE = "https://worldcup26.ir";
const CACHE_TTL_MS = 90_000; // 90 seconds

interface WC26Game {
  _id: string;
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  group: string;
  matchday: string;
  local_date: string; // "MM/DD/YYYY HH:mm"
  finished: string;   // "TRUE" | "FALSE"
  time_elapsed: string; // "notstarted" | "finished" | "45'" | etc.
  type: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;  // knockout stage TBD teams
  away_team_label?: string;
}

export interface MatchData {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: "live" | "scheduled" | "finished";
  kickoff_at: string;
}

let cache: { matches: MatchData[]; teamMap: Map<string, string>; at: number } | null = null;

/** Parse "MM/DD/YYYY HH:mm" into an ISO timestamp (treated as EST = UTC-5 during group stage) */
function parseLocalDate(s: string): string {
  // format: "06/14/2026 15:00"
  const [datePart, timePart] = s.split(" ");
  if (!datePart) return new Date().toISOString();
  const [mm, dd, yyyy] = datePart.split("/");
  const [hh, min] = (timePart ?? "00:00").split(":");
  // Treat as UTC-5 (US Eastern, most host venues)
  return new Date(
    Date.UTC(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh) + 5,
      Number(min)
    )
  ).toISOString();
}

function mapStatus(game: WC26Game): "live" | "scheduled" | "finished" {
  if (game.finished === "TRUE" || game.time_elapsed === "finished") return "finished";
  if (game.time_elapsed && game.time_elapsed !== "notstarted") return "live";
  return "scheduled";
}

function mapGame(game: WC26Game): MatchData {
  const homeName =
    game.home_team_name_en ?? game.home_team_label ?? `Home (${game.home_team_id})`;
  const awayName =
    game.away_team_name_en ?? game.away_team_label ?? `Away (${game.away_team_id})`;

  return {
    id: `wc26-${game.id}`,
    fixture_id: Number(game.id),
    home_team: homeName,
    away_team: awayName,
    home_score: Number(game.home_score) || 0,
    away_score: Number(game.away_score) || 0,
    status: mapStatus(game),
    kickoff_at: parseLocalDate(game.local_date),
  };
}

async function fetchAll(): Promise<{ matches: MatchData[]; teamMap: Map<string, string> }> {
  const res = await fetch(`${WC26_BASE}/get/games`, {
    headers: { "User-Agent": "MatchCast-AI/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WC26 API error: ${res.status}`);
  const body = (await res.json()) as { games: WC26Game[] };
  const games: WC26Game[] = body.games ?? [];

  const teamMap = new Map<string, string>();
  games.forEach((g) => {
    if (g.home_team_id && g.home_team_name_en) teamMap.set(g.home_team_id, g.home_team_name_en);
    if (g.away_team_id && g.away_team_name_en) teamMap.set(g.away_team_id, g.away_team_name_en);
  });

  const matches = games.map(mapGame);
  return { matches, teamMap };
}

export async function getRelevantMatches(): Promise<MatchData[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return filterRelevant(cache.matches);
  }
  try {
    const result = await fetchAll();
    cache = { ...result, at: Date.now() };
    return filterRelevant(cache.matches);
  } catch {
    // Return cached data even if stale, rather than failing
    if (cache) return filterRelevant(cache.matches);
    throw new Error("WC26 API unavailable");
  }
}

export async function getMatchById(wc26Id: string): Promise<MatchData | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.matches.find((m) => m.id === wc26Id) ?? null;
  }
  try {
    const result = await fetchAll();
    cache = { ...result, at: Date.now() };
    return cache.matches.find((m) => m.id === wc26Id) ?? null;
  } catch {
    return cache?.matches.find((m) => m.id === wc26Id) ?? null;
  }
}

function filterRelevant(all: MatchData[]): MatchData[] {
  const now = Date.now();
  const DAY = 86_400_000;

  // Always include live matches
  const live = all.filter((m) => m.status === "live");

  // Show matches within a 3-day window: yesterday → day after tomorrow
  const window = all.filter((m) => {
    const t = new Date(m.kickoff_at).getTime();
    return t >= now - DAY && t <= now + 2 * DAY;
  });

  // If nothing in the window, expand to last 2 finished + next 4 scheduled
  if (live.length === 0 && window.length === 0) {
    const finished = all
      .filter((m) => m.status === "finished")
      .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
      .slice(0, 2);
    const upcoming = all
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
      .slice(0, 4);
    return dedup([...finished.reverse(), ...upcoming]);
  }

  return dedup([...live, ...window]).sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );
}

function dedup(matches: MatchData[]): MatchData[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Commentary templates  — {home} and {away} are replaced with real team names
// ---------------------------------------------------------------------------

export const COMMENTARY_TEMPLATES: Record<string, { text: string; eventType: string; minute: number | null }[][]> = {
  hi: [
    // Template set 0 — used for live / scheduled matches
    [
      { text: "मैच का पहला मिनट — {home} और {away} के खिलाड़ी पूरी तरह तैयार हैं। किकऑफ हो चुका है!", eventType: "kickoff", minute: 1 },
      { text: "15वें मिनट में {away} ने दबाव बनाया, लेकिन {home} के डिफेंडरों ने गेंद को क्लियर कर दिया।", eventType: "commentary", minute: 15 },
      { text: "22वें मिनट — {home} का कॉर्नर किक! क्रॉस अच्छा था लेकिन हेडर बाहर गया।", eventType: "commentary", minute: 22 },
      { text: "35वें मिनट में {away} के मिडफील्डर ने शानदार पास खेला, लेकिन स्ट्राइकर अंतिम समय में गेंद से चूक गया।", eventType: "commentary", minute: 35 },
      { text: "45वें मिनट + 2 — हाफ टाइम! पहला हाफ बराबरी पर समाप्त। दोनों टीमें सतर्क रही हैं।", eventType: "half_time", minute: 45 },
      { text: "दूसरा हाफ शुरू! {home} ने आक्रामक रवैया अपनाया है। अगले 45 मिनट निर्णायक होंगे।", eventType: "commentary", minute: 46 },
      { text: "58वें मिनट — {home} के स्ट्राइकर ने पेनल्टी बॉक्स में घुसकर जोरदार शॉट लगाया! गोलकीपर ने बेहतरीन बचाव किया।", eventType: "commentary", minute: 58 },
      { text: "67वें मिनट — VAR जांच हो रही है! रेफरी मॉनिटर देख रहे हैं। पूरा स्टेडियम चुप है।", eventType: "var", minute: 67 },
      { text: "78वें मिनट में {away} की टीम ने दबाव बढ़ाया। {home} का बचाव परखा जा रहा है।", eventType: "commentary", minute: 78 },
      { text: "मैच समाप्त! {home} और {away} के बीच रोमांचक मुकाबला खत्म हुआ।", eventType: "full_time", minute: 90 },
    ],
    // Template set 1 — goal match
    [
      { text: "मैच शुरू! {home} और {away} के बीच फीफा विश्व कप 2026 का ग्रुप मुकाबला।", eventType: "kickoff", minute: 1 },
      { text: "12वें मिनट — {home} का खतरनाक हमला! बायें विंग से क्रॉस आया, हेडर गोल से थोड़ा चूका।", eventType: "commentary", minute: 12 },
      { text: "गोल! {home} ने 31वें मिनट में बढ़त ले ली! शानदार फिनिश — 1-0!", eventType: "goal", minute: 31 },
      { text: "38वें मिनट — {away} को येलो कार्ड। खुरदरी टैकल पर रेफरी ने हस्तक्षेप किया।", eventType: "yellow_card", minute: 38 },
      { text: "हाफ टाइम! {home} 1-0 से आगे है। {away} को बदलाव करने होंगे।", eventType: "half_time", minute: 45 },
      { text: "52वें मिनट — {away} की जवाबी कार्रवाई! फ्री किक से करीबी मौका।", eventType: "commentary", minute: 52 },
      { text: "63वें मिनट — {home} का सब्स्टिट्यूशन। टीम रणनीति बदल रही है।", eventType: "substitution", minute: 63 },
      { text: "गोल! {away} ने 74वें मिनट में बराबरी कर ली! 1-1! स्टेडियम में जोश है।", eventType: "goal", minute: 74 },
      { text: "83वें मिनट — {home} और {away} दोनों जीत के लिए खेल रहे हैं। तीव्र मुकाबला।", eventType: "commentary", minute: 83 },
      { text: "मैच खत्म! 1-1 — दोनों टीमों को एक-एक अंक। ग्रुप स्टेज में यह बराबरी महत्वपूर्ण रहेगी।", eventType: "full_time", minute: 90 },
    ],
  ],
  ta: [
    [
      { text: "போட்டி தொடங்கியது! {home} மற்றும் {away} ஆட்டக்காரர்கள் முழு ஆர்வத்துடன் உள்ளனர்.", eventType: "kickoff", minute: 1 },
      { text: "15வது நிமிடம் — {away} அழுத்தம் கொடுக்கிறது, ஆனால் {home} பாதுகாப்பு திடமாக உள்ளது.", eventType: "commentary", minute: 15 },
      { text: "22வது நிமிடம் — {home} கார்னர் கிக். கிராஸ் சரியாக இருந்தது, ஆனால் ஹெடர் தவறியது.", eventType: "commentary", minute: 22 },
      { text: "35வது நிமிடம் — {away} மிட்ஃபீல்டர் நல்ல பாஸ் கொடுத்தார், ஆனால் ஸ்ட்ரைக்கர் கோல் அடிக்கவில்லை.", eventType: "commentary", minute: 35 },
      { text: "45+2வது நிமிடம் — இடைவேளை! முதல் பாதி சமனிலையில் முடிந்தது.", eventType: "half_time", minute: 45 },
      { text: "இரண்டாம் பாதி தொடங்கியது! {home} தாக்குதல் தீவிரப்படுத்துகிறது.", eventType: "commentary", minute: 46 },
      { text: "58வது நிமிடம் — {home} ஸ்ட்ரைக்கர் வலிமையான ஷாட் அடித்தார்! கீப்பர் சிறப்பான காப்பு காட்டினார்.", eventType: "commentary", minute: 58 },
      { text: "67வது நிமிடம் — VAR ஆய்வு! ரெஃப்ரி மானிட்டரை பார்க்கிறார்.", eventType: "var", minute: 67 },
      { text: "78வது நிமிடம் — {away} அழுத்தம் அதிகரிக்கிறது. {home} பாதுகாப்பு சவாலுக்கு உள்ளாகிறது.", eventType: "commentary", minute: 78 },
      { text: "போட்டி முடிந்தது! {home} மற்றும் {away} இடையே அற்புதமான போட்டி.", eventType: "full_time", minute: 90 },
    ],
    [
      { text: "கிக்ஆஃப்! {home} எதிர் {away} — FIFA உலகக்கிண்ணம் 2026 குழு வட்டம்.", eventType: "kickoff", minute: 1 },
      { text: "12வது நிமிடம் — {home} இடது பக்கம் தாக்குதல். கிராஸ் நல்லது, ஹெடர் தவறியது.", eventType: "commentary", minute: 12 },
      { text: "கோல்! {home} 31வது நிமிடத்தில் முன்னிலை. அற்புதமான ஃபினிஷ் — 1-0!", eventType: "goal", minute: 31 },
      { text: "38வது நிமிடம் — {away} வீரருக்கு மஞ்சள் அட்டை.", eventType: "yellow_card", minute: 38 },
      { text: "இடைவேளை! {home} 1-0 முன்னிலையில். {away} தந்திரம் மாற்ற வேண்டும்.", eventType: "half_time", minute: 45 },
      { text: "52வது நிமிடம் — {away} கவுண்டர். ஃப்ரீ கிக்கில் நெருக்கமான வாய்ப்பு.", eventType: "commentary", minute: 52 },
      { text: "63வது நிமிடம் — {home} மாற்றீடு. தந்திர மாற்றம்.", eventType: "substitution", minute: 63 },
      { text: "கோல்! {away} 74வது நிமிடத்தில் சமன் செய்தது! 1-1! ஸ்டேடியம் உற்சாகம்.", eventType: "goal", minute: 74 },
      { text: "83வது நிமிடம் — இரு அணிகளும் வெற்றிக்கு முயற்சிக்கின்றன.", eventType: "commentary", minute: 83 },
      { text: "போட்டி முடிந்தது! 1-1 — இரு அணிகளுக்கும் ஒரு புள்ளி.", eventType: "full_time", minute: 90 },
    ],
  ],
  te: [
    [
      { text: "మ్యాచ్ ప్రారంభం! {home} మరియు {away} ఆటగాళ్ళు పూర్తి ఉత్సాహంతో ఉన్నారు.", eventType: "kickoff", minute: 1 },
      { text: "15వ నిమిషం — {away} ఒత్తిడి తెస్తోంది, కానీ {home} రక్షణ గట్టిగా ఉంది.", eventType: "commentary", minute: 15 },
      { text: "22వ నిమిషం — {home} కార్నర్ కిక్. క్రాస్ మంచిది, కానీ హెడర్ తప్పింది.", eventType: "commentary", minute: 22 },
      { text: "35వ నిమిషం — {away} మిడ్‌ఫీల్డర్ మంచి పాస్ ఇచ్చాడు, కానీ స్ట్రైకర్ గోల్ చేయలేదు.", eventType: "commentary", minute: 35 },
      { text: "45+2వ నిమిషం — హాఫ్ టైమ్! మొదటి సగం సమానంగా ముగిసింది.", eventType: "half_time", minute: 45 },
      { text: "రెండవ సగం ప్రారంభం! {home} దాడి తీవ్రతరం చేస్తోంది.", eventType: "commentary", minute: 46 },
      { text: "58వ నిమిషం — {home} స్ట్రైకర్ శక్తివంతమైన షాట్ తీశాడు! కీపర్ అద్భుతమైన సేవ్ చేశాడు.", eventType: "commentary", minute: 58 },
      { text: "67వ నిమిషం — VAR తనిఖీ! రెఫరీ మానిటర్ చూస్తున్నాడు.", eventType: "var", minute: 67 },
      { text: "78వ నిమిషం — {away} ఒత్తిడి పెరుగుతోంది. {home} రక్షణ పరీక్షకు గురవుతోంది.", eventType: "commentary", minute: 78 },
      { text: "మ్యాచ్ ముగిసింది! {home} మరియు {away} మధ్య అద్భుతమైన పోటీ.", eventType: "full_time", minute: 90 },
    ],
    [
      { text: "కిక్‌ఆఫ్! {home} vs {away} — FIFA వరల్డ్ కప్ 2026 గ్రూప్ స్టేజ్.", eventType: "kickoff", minute: 1 },
      { text: "12వ నిమిషం — {home} ఎడమ వైపు దాడి. క్రాస్ మంచిది, హెడర్ తప్పింది.", eventType: "commentary", minute: 12 },
      { text: "గోల్! {home} 31వ నిమిషంలో ముందుంది. అద్భుతమైన ఫినిష్ — 1-0!", eventType: "goal", minute: 31 },
      { text: "38వ నిమిషం — {away} ఆటగాడికి పసుపు కార్డు.", eventType: "yellow_card", minute: 38 },
      { text: "హాఫ్ టైమ్! {home} 1-0తో ముందుంది. {away} వ్యూహం మార్చాలి.", eventType: "half_time", minute: 45 },
      { text: "52వ నిమిషం — {away} కౌంటర్. ఫ్రీ కిక్ నుండి దగ్గర అవకాశం.", eventType: "commentary", minute: 52 },
      { text: "63వ నిమిషం — {home} సబ్స్టిట్యూషన్. వ్యూహ మార్పు.", eventType: "substitution", minute: 63 },
      { text: "గోల్! {away} 74వ నిమిషంలో సమానం చేసింది! 1-1! స్టేడియం ఉత్సాహంలో ఉంది.", eventType: "goal", minute: 74 },
      { text: "83వ నిమిషం — రెండు జట్లూ గెలుపు కోసం ఆడుతున్నాయి.", eventType: "commentary", minute: 83 },
      { text: "మ్యాచ్ ముగిసింది! 1-1 — రెండు జట్లకూ ఒక్కో పాయింట్.", eventType: "full_time", minute: 90 },
    ],
  ],
  mr: [
    [
      { text: "सामना सुरू! {home} आणि {away} खेळाडू पूर्ण उत्साहात आहेत.", eventType: "kickoff", minute: 1 },
      { text: "15वे मिनिट — {away} दबाव आणत आहे, पण {home}चे रक्षण भक्कम आहे.", eventType: "commentary", minute: 15 },
      { text: "22वे मिनिट — {home}चा कॉर्नर किक! चांगला क्रॉस होता, पण हेड बाहेर गेला.", eventType: "commentary", minute: 22 },
      { text: "35वे मिनिट — {away}च्या मिडफील्डरने चांगला पास दिला, पण स्ट्रायकर गोल करू शकला नाही.", eventType: "commentary", minute: 35 },
      { text: "45+2 मिनिट — हाफ टाइम! पहिला अर्धा सामना बरोबरीत संपला.", eventType: "half_time", minute: 45 },
      { text: "दुसरा हाफ सुरू! {home} आक्रमण तीव्र करत आहे.", eventType: "commentary", minute: 46 },
      { text: "58वे मिनिट — {home}च्या स्ट्रायकरने जोरदार शॉट मारला! गोलकीपरने अफलातून बचाव केला.", eventType: "commentary", minute: 58 },
      { text: "67वे मिनिट — VAR तपासणी! पंच मॉनिटर पाहत आहेत.", eventType: "var", minute: 67 },
      { text: "78वे मिनिट — {away} दबाव वाढवत आहे. {home}चा बचाव परीक्षेला आहे.", eventType: "commentary", minute: 78 },
      { text: "सामना संपला! {home} आणि {away} यांच्यात रोमांचक लढत.", eventType: "full_time", minute: 90 },
    ],
    [
      { text: "किकऑफ! {home} विरुद्ध {away} — FIFA विश्वचषक 2026 गट टप्पा.", eventType: "kickoff", minute: 1 },
      { text: "12वे मिनिट — {home}चा डाव्या बाजूने हल्ला. क्रॉस चांगला, पण हेड चुकला.", eventType: "commentary", minute: 12 },
      { text: "गोल! {home}ने 31व्या मिनिटाला आघाडी घेतली! सुंदर फिनिश — 1-0!", eventType: "goal", minute: 31 },
      { text: "38वे मिनिट — {away}च्या खेळाडूला पिवळे कार्ड.", eventType: "yellow_card", minute: 38 },
      { text: "हाफ टाइम! {home} 1-0 पुढे आहे. {away}ला बदल करावे लागतील.", eventType: "half_time", minute: 45 },
      { text: "52वे मिनिट — {away}चा काउंटर. फ्री किकवरून जवळचा मौका.", eventType: "commentary", minute: 52 },
      { text: "63वे मिनिट — {home}चा बदल. डावपेचात बदल.", eventType: "substitution", minute: 63 },
      { text: "गोल! {away}ने 74व्या मिनिटाला बरोबरी साधली! 1-1! स्टेडियम दुमदुमलं.", eventType: "goal", minute: 74 },
      { text: "83वे मिनिट — दोन्ही संघ विजयासाठी खेळत आहेत.", eventType: "commentary", minute: 83 },
      { text: "सामना संपला! 1-1 — दोन्ही संघांना एक-एक गुण.", eventType: "full_time", minute: 90 },
    ],
  ],
};

/** Return template lines with {home}/{away} substituted */
export function getCommentary(
  lang: string,
  homeTeam: string,
  awayTeam: string,
  templateSet: 0 | 1 = 0
): { text: string; eventType: string; minute: number | null }[] {
  const langKey = ["hi", "ta", "te", "mr"].includes(lang) ? lang : "hi";
  const sets = COMMENTARY_TEMPLATES[langKey];
  const set = sets[templateSet] ?? sets[0];
  return set.map((line) => ({
    ...line,
    text: line.text.replace(/\{home\}/g, homeTeam).replace(/\{away\}/g, awayTeam),
  }));
}

/** Pick template set based on home score — if home won/leading, use set 1 (goal match) */
export function pickTemplateSet(homeScore: number, awayScore: number): 0 | 1 {
  return homeScore > 0 || awayScore > 0 ? 1 : 0;
}
