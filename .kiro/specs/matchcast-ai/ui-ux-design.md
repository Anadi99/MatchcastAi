# UI/UX Design Document
# MatchCast AI — World Cup 2026

## 1. Design Principles

- Mobile-first: 80%+ of users will be on phones
- Speed over decoration: commentary arrives fast, UI should feel fast too
- Language-native typography: use system fonts that render Devanagari, Tamil, Telugu scripts correctly
- Dark mode default: matches the Telegram aesthetic; easier on eyes during night matches
- Minimal friction: /start → language pick → match subscribe in under 60 seconds

---

## 2. Telegram Bot UX

### 2.1 Onboarding Flow

```
User sends /start
↓
Bot responds:
┌─────────────────────────────────────────┐
│ 🏆 MatchCast AI — World Cup 2026        │
│                                         │
│ Live football commentary in your        │
│ language. Pick your language to start:  │
│                                         │
│  [🇮🇳 हिंदी]    [🌺 தமிழ்]           │
│  [⚡ తెలుగు]   [🎪 मराठी]            │
└─────────────────────────────────────────┘
↓
User taps language
↓
Bot responds:
┌─────────────────────────────────────────┐
│ ✅ हिंदी सेट हो गया!                  │
│                                         │
│ अब एक मैच चुनें:                       │
│  /matches — लाइव और आने वाले मैच       │
│  /help — सभी कमांड                     │
└─────────────────────────────────────────┘
```

### 2.2 Match Selection Flow

```
/matches command
↓
┌─────────────────────────────────────────┐
│ 🏟️ आज के मैच — 14 जून 2026            │
│                                         │
│ 🔴 LIVE                                 │
│ 🇧🇷 Brazil vs 🇦🇷 Argentina          │
│ 45+2' | 1 – 0                          │
│ [📺 Subscribe] — Match #1234            │
│                                         │
│ ⏰ Tonight 9:30 PM IST                  │
│ 🇫🇷 France vs 🇩🇪 Germany            │
│ [🔔 Remind Me] — Match #1235           │
└─────────────────────────────────────────┘
```

### 2.3 Live Commentary Message Format

```
⚽ GOAL! — 67'
┌─────────────────────────────────────────┐
│ ब्राज़ील ने कर दिया कमाल! नेमार ने  │
│ बाएं पैर से ऐसा गोल मारा कि पूरा    │
│ स्टेडियम हिल गया! अर्जेंटीना के     │
│ गोलकीपर की आँखें फटी रह गईं!        │
│                                         │
│ 🏆 Brazil 2 – 0 Argentina | 67'       │
└─────────────────────────────────────────┘
```

### 2.4 Pulse Update Format

```
⏱️ 60-Second Pulse — 34'
┌─────────────────────────────────────────┐
│ ब्राज़ील का मिडफील्ड पर कब्ज़ा है — │
│ 64% possession। लेकिन अर्जेंटीना की  │
│ defence अभी भी चट्टान की तरह खड़ी  │
│ है। रोमांच अभी बाकी है!              │
│                                         │
│ 🏆 Brazil 1 – 0 Argentina | 34'       │
└─────────────────────────────────────────┘
```

### 2.5 Sponsor Message Format

```
⚽ [Match update above]
──────────────────────
💡 Sponsored by Dream11
"क्या आप भी फुटबॉल फैंटेसी खेलते हैं?
Dream11 पर अपनी टीम बनाएं — 
कोड MATCHCAST से ₹100 बोनस पाएं!"
dream11.com/matchcast
──────────────────────
```

### 2.6 Match Summary Format

```
🏁 FULL TIME — Brazil 2 – 0 Argentina
┌─────────────────────────────────────────┐
│ 🏆 Brazil ने Argentina को 2-0 से हराया │
│                                         │
│ ⚽ गोल: नेमार (23'), विनीसियस (67')   │
│ 🌟 Player of the Match: नेमार         │
│ 🧠 Tactical: Brazil का possession game │
│    Argentina की defence को तोड़ न सका  │
│    लेकिन counter से मिली जीत           │
│                                         │
│ 🔥 एक ऐतिहासिक जीत — Copa कहानी      │
│    फिर से लिखी गई!                    │
└─────────────────────────────────────────┘

📤 Share करें:
"Brazil 2 – 0 Argentina | WC 2026
नेमार और विनीसियस के गोलों से Brazil ने
Argentina को हराया। #MatchCastAI"
```

### 2.7 Premium Upgrade Flow

```
/premium command
↓
┌─────────────────────────────────────────┐
│ ⭐ MatchCast Premium                    │
│                                         │
│ सिर्फ ₹99/महीना                        │
│                                         │
│ ✅ सभी 4 भाषाएं                        │
│ ✅ कोई ads नहीं                         │
│ ✅ Pre-match report (30 min पहले)       │
│ ✅ Full match analysis                  │
│                                         │
│  [💳 ₹99 में Subscribe करें]           │
│  [ℹ️ More Info]                        │
└─────────────────────────────────────────┘
↓
Razorpay payment link opens in browser
↓
Payment success → Bot sends confirmation
```

---

## 3. Web Feed (matchcast.in)

### 3.1 Page Layout (Mobile-First)

```
┌─────────────────────────────────┐
│ MatchCast AI          🌐 हिंदी ▼│  ← Header: logo + language toggle
├─────────────────────────────────┤
│ 🔴 LIVE  Brazil vs Argentina    │  ← Match selector tabs
│ ⏰ France vs Germany — 9:30 PM  │
├─────────────────────────────────┤
│ 🏆 Brazil 1 – 0 Argentina | 34' │  ← Scoreboard (sticky)
├─────────────────────────────────┤
│ ⚽ GOAL! 23'                    │  ← Commentary feed (newest first)
│ नेमार ने दाएं कोने से...        │
│ ─────────────────────────────   │
│ ⏱️ Pulse 20'                   │
│ Brazil का possession...          │
│ ─────────────────────────────   │
│ 💡 Dream11 — फैंटेसी खेलें     │  ← Sponsor card
│ ─────────────────────────────   │
│ 🕐 Match Start 0'               │
│ आज का मैच शुरू हो गया!         │
├─────────────────────────────────┤
│ 📲 Telegram पर पाएं → @MatchCastBot │ ← CTA footer
└─────────────────────────────────┘
```

### 3.2 Desktop Layout

- Two-column: match list on left (240px), commentary feed on right
- Commentary feed: max-width 680px, centered
- Sponsor cards: full-width within feed, visually distinct background

### 3.3 Component Inventory

| Component | Description |
|---|---|
| `MatchSelector` | Tabs or dropdown for active matches |
| `Scoreboard` | Sticky score + time display |
| `CommentaryFeed` | Scrollable list of `CommentaryCard` items |
| `CommentaryCard` | Single update: event type icon, minute, text |
| `SponsorCard` | Sponsor message with distinct styling |
| `LanguageToggle` | Dropdown: Hindi / Tamil / Telugu / Marathi |
| `FullTimeSummary` | Full-time match summary card with share button |
| `TelegramCTA` | Persistent banner: "Get on Telegram" |

### 3.4 Colour Palette

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#0F1117` | Page background |
| `bg-card` | `#1A1D27` | Commentary card background |
| `bg-sponsor` | `#1E2A1A` | Sponsor card background (green tint) |
| `accent-live` | `#FF3B3B` | LIVE indicator, goal highlights |
| `accent-pulse` | `#3B82F6` | Pulse update accent |
| `accent-gold` | `#F59E0B` | Match summary, premium |
| `text-primary` | `#F0F0F0` | Primary text |
| `text-muted` | `#6B7280` | Minute, metadata |

### 3.5 Typography

- English UI: `Inter` (Google Fonts)
- Hindi/Marathi: `Noto Sans Devanagari` — renders cleanly at all sizes
- Tamil: `Noto Sans Tamil`
- Telugu: `Noto Sans Telugu`
- Font loading: subset via `next/font`, only load active language font

### 3.6 Real-Time Updates

- Implemented via Server-Sent Events (SSE) from `/api/stream/{matchId}?lang={code}`
- Next.js route handler streams new commentary as `data:` events
- Client: `EventSource` API, appends new `CommentaryCard` to top of feed
- On reconnect: fetches last 10 updates to fill gap

### 3.7 Accessibility

- All interactive elements have `aria-label`
- Language toggle uses `<select>` with visible label
- Commentary cards: `role="article"`, timestamp as `<time>` element
- Colour contrast: all text meets WCAG AA (4.5:1)
- Keyboard navigation: tab order follows visual order
- `prefers-reduced-motion`: disables card slide-in animation

---

## 4. Error States

| State | Bot Message | Web UI |
|---|---|---|
| No active match | "कोई लाइव मैच नहीं — /matches से आगामी मैच देखें" | Empty state with next match countdown |
| API-Football down | Commentary paused banner + retry notice | Yellow warning banner |
| Gemini failure (after retry) | Plain-language event description | Card with ⚠️ icon, plain text |
| Payment failure | "Payment नहीं हुआ। Try again: /premium" | Redirect back to /premium page |
| Subscription expired | "आपकी Premium membership खत्म हो गई। /premium से renew करें" | — |
