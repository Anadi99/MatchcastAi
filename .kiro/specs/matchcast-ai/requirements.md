# Requirements Document

## Introduction

MatchCast AI is a live football commentary product targeting Indian fans during World Cup 2026 and beyond. It delivers AI-generated, emotionally-charged commentary in Hindi, Tamil, Telugu, and Marathi — every 60 seconds and on every key match event — via Telegram bot, with a web fallback at matchcast.in. Revenue comes from weekly sponsorships, a ₹99/month premium tier, and a post-launch white-label API.

Build window: 14 days solo. Revenue target: ₹12L over the 6-week World Cup window.

---

## Glossary

- **System**: The MatchCast AI platform as a whole
- **Bot**: The Telegram bot interface (node-telegram-bot-api)
- **Commentary_Engine**: The AI module that generates commentary text using Google Gemini 1.5 Flash
- **Poller**: The cron-based job that fetches live match data from API-Football every 60 seconds
- **Event_Processor**: The module that detects new match events and triggers commentary generation
- **Sponsor_Injector**: The module that inserts sponsor messages into the update stream
- **Language_Manager**: The module that stores and applies per-user language preferences
- **Subscription_Manager**: The module that manages free vs. premium user tiers
- **Web_Feed**: The Next.js frontend at matchcast.in that shows the live commentary feed
- **User**: A person who has started the Telegram bot or is viewing the Web_Feed
- **Premium_User**: A User with an active ₹99/month subscription
- **Free_User**: A User without an active paid subscription
- **Match_Event**: A discrete in-game occurrence — goal, red/yellow card, substitution, VAR decision, kick-off, full time
- **Pulse_Update**: A 60-second periodic update sent even when no Match_Event has occurred
- **Match_Summary**: A 5-line AI-generated report produced at full time
- **Sponsor_Message**: A sponsor-provided promotional text injected every 4th update
- **API-Football**: The third-party data provider at apifootball.com
- **Supabase**: The PostgreSQL-backed database and auth service
- **Razorpay**: The payment gateway used to process premium subscriptions
- **Railway**: The cloud hosting platform for the Node.js backend
- **White_Label_API**: A paid REST API exposing commentary and match data to third-party clients

---

## Requirements

### Requirement 1: User Onboarding and Language Selection

**User Story:** As a new user, I want to choose my preferred language when I start the bot, so that all commentary is delivered in the language I understand best.

#### Acceptance Criteria

1. WHEN a User sends `/start` to the Bot, THE Bot SHALL present a language selection menu with the options: Hindi, Tamil, Telugu, Marathi.
2. WHEN a User selects a language, THE Language_Manager SHALL persist that preference to Supabase, associated with the User's Telegram ID.
3. WHEN a User sends `/language` to the Bot, THE Bot SHALL present the language selection menu again, allowing the User to change their preference.
4. IF a User sends any command before completing language selection, THEN THE Bot SHALL prompt the User to complete language selection before proceeding.
5. THE Language_Manager SHALL default to Hindi if no language preference has been recorded for a User.
6. WHEN a User changes their language preference, THE Language_Manager SHALL apply the new preference to all subsequent updates for that User.

---

### Requirement 2: Live Match Event Commentary

**User Story:** As a football fan, I want to receive instant commentary for every key match event, so that I feel the excitement of the game in real time even when I can't watch it.

#### Acceptance Criteria

1. WHEN a Match_Event of type goal, red card, yellow card, substitution, or VAR decision is detected by the Event_Processor, THE Commentary_Engine SHALL generate a 2–3 sentence commentary update in the User's chosen language within 10 seconds of event detection.
2. THE Commentary_Engine SHALL invoke Google Gemini 1.5 Flash with a prompt that includes: event type, event detail, current score, match minute, home team, away team, and venue.
3. THE Commentary_Engine SHALL apply language-specific tone rules: Hindi commentary SHALL use dramatic and high-emotion language; Tamil commentary SHALL use poetic and lyrical language; Telugu commentary SHALL use energetic and exclamatory language; Marathi commentary SHALL use a conversational local tone.
4. THE Commentary_Engine SHALL restrict generated text to a maximum of 60 words per update.
5. THE Commentary_Engine SHALL avoid English words except for player names and team names.
6. THE Commentary_Engine SHALL end every commentary update with a short reaction line.
7. IF the Commentary_Engine receives an error response from Gemini, THEN THE System SHALL retry the request once and, if the retry fails, SHALL deliver a fallback plain-language event description to the User.
8. THE Event_Processor SHALL deduplicate Match_Events so that the same event is not delivered more than once per User per match.

---

### Requirement 3: 60-Second Pulse Updates

**User Story:** As a fan following a quiet spell in the game, I want to receive a short situation update every 60 seconds, so that I always feel connected to the match tempo.

#### Acceptance Criteria

1. WHILE a match is in progress, THE Poller SHALL fetch updated match data from API-Football at an interval not exceeding 60 seconds.
2. WHILE a match is in progress and no Match_Event has been detected in the previous 60 seconds, THE Commentary_Engine SHALL generate a Pulse_Update describing current possession, match tempo, or tactical observation.
3. THE Commentary_Engine SHALL generate Pulse_Updates in the User's chosen language, following the same tone rules as event commentary.
4. THE Commentary_Engine SHALL restrict Pulse_Update text to a maximum of 60 words.
5. IF API-Football returns an error or timeout, THEN THE Poller SHALL retry after 10 seconds and, if the retry also fails, SHALL skip that polling cycle without delivering a Pulse_Update.
6. WHEN a match ends, THE Poller SHALL stop polling for that match within 60 seconds of the full-time event being detected.

---

### Requirement 4: Match Summary at Full Time

**User Story:** As a fan, I want a shareable match summary at the end of the game, so that I can relive the key moments and share the result with friends.

#### Acceptance Criteria

1. WHEN the Event_Processor detects a full-time Match_Event, THE Commentary_Engine SHALL generate a Match_Summary within 30 seconds.
2. THE Match_Summary SHALL contain exactly 5 lines covering: final score and result, key goals and moments, player of the match, tactical verdict, and an emotional closing line.
3. THE Match_Summary SHALL be generated in the User's chosen language following the tone rules for that language.
4. THE Bot SHALL deliver the Match_Summary to all subscribed Users for that match.
5. THE Bot SHALL append a share-ready plain-text version of the Match_Summary that a User can forward directly in Telegram or WhatsApp.
6. IF the Commentary_Engine fails to generate a Match_Summary, THEN THE System SHALL deliver a plain-text summary constructed from the raw match statistics instead.

---

### Requirement 5: Sponsor Message Injection

**User Story:** As a sponsor, I want my message to appear in the commentary feed at a predictable cadence, so that I get consistent brand exposure throughout the match.

#### Acceptance Criteria

1. THE Sponsor_Injector SHALL insert a Sponsor_Message as every 4th update delivered to each Free_User.
2. THE Sponsor_Injector SHALL retrieve the active Sponsor_Message for the current time window from Supabase.
3. WHEN no active Sponsor_Message exists in Supabase, THE Sponsor_Injector SHALL omit the injection and deliver the update without a sponsor message.
4. THE Sponsor_Injector SHALL clearly separate the Sponsor_Message from the commentary content using a visible delimiter in the message.
5. THE Subscription_Manager SHALL suppress Sponsor_Messages for Premium_Users.
6. THE System SHALL record each Sponsor_Message delivery event in Supabase, including timestamp and User ID, to support sponsor reporting.

---

### Requirement 6: Free vs. Premium Subscription Tiers

**User Story:** As a power fan, I want to upgrade to a premium subscription, so that I can access all four languages, remove ads, and receive pre-match and post-match reports.

#### Acceptance Criteria

1. THE Subscription_Manager SHALL grant Free_Users access to Hindi commentary only, with Sponsor_Messages enabled.
2. THE Subscription_Manager SHALL grant Premium_Users access to all four languages (Hindi, Tamil, Telugu, Marathi), with Sponsor_Messages suppressed.
3. WHEN a User sends `/premium` to the Bot, THE Bot SHALL display the subscription price (₹99/month) and a Razorpay payment link.
4. WHEN a Razorpay payment webhook confirms a successful payment for a User, THE Subscription_Manager SHALL upgrade that User's tier to Premium in Supabase within 60 seconds.
5. WHEN a Premium_User's subscription expires, THE Subscription_Manager SHALL downgrade the User to the Free tier and notify the User via the Bot.
6. THE Subscription_Manager SHALL provide Premium_Users with a pre-match report delivered 30 minutes before kick-off.
7. THE Subscription_Manager SHALL provide Premium_Users with a post-match report equivalent to the Match_Summary defined in Requirement 4.
8. IF a Razorpay webhook event cannot be verified using the webhook signature, THEN THE System SHALL reject the event and log the failure.

---

### Requirement 7: Telegram Bot Interface

**User Story:** As a user, I want a simple and intuitive bot interface, so that I can subscribe to matches and control my experience without needing a separate app.

#### Acceptance Criteria

1. THE Bot SHALL support the following commands: `/start`, `/language`, `/matches`, `/subscribe {match_id}`, `/unsubscribe {match_id}`, `/status`, `/premium`, `/help`.
2. WHEN a User sends `/matches`, THE Bot SHALL display a list of upcoming and live World Cup matches with their match IDs.
3. WHEN a User sends `/subscribe {match_id}`, THE Bot SHALL register the User as a subscriber for that match and confirm the subscription.
4. WHEN a User sends `/unsubscribe {match_id}`, THE Bot SHALL remove the User's subscription for that match and confirm the removal.
5. WHEN a User sends `/status`, THE Bot SHALL display the User's current language preference, subscription tier, and active match subscriptions.
6. IF a User sends an unrecognised command, THEN THE Bot SHALL respond with a helpful message listing available commands.
7. THE Bot SHALL respond to all commands within 3 seconds under normal load.

---

### Requirement 8: Web Feed (matchcast.in)

**User Story:** As a user who doesn't want to install Telegram, I want to view the live commentary feed on a website, so that I can follow the match from any browser.

#### Acceptance Criteria

1. THE Web_Feed SHALL display live commentary updates for all currently active matches in real time, updating without requiring a full page reload.
2. THE Web_Feed SHALL display commentary in Hindi by default.
3. WHERE a User selects a language on the Web_Feed, THE Web_Feed SHALL update the displayed commentary language for that session.
4. THE Web_Feed SHALL display Sponsor_Messages in the feed at the same 4th-update cadence as the Bot.
5. THE Web_Feed SHALL show a match selector allowing the User to switch between active matches.
6. THE Web_Feed SHALL be accessible and render correctly on mobile browsers (viewport width ≥ 320px).
7. THE Web_Feed SHALL achieve a Lighthouse performance score of 80 or above on mobile.

---

### Requirement 9: Live Data Polling and Deduplication

**User Story:** As a system operator, I want the polling loop to be reliable and deduplicated, so that users never receive duplicate commentary for the same event.

#### Acceptance Criteria

1. THE Poller SHALL fetch match fixtures for the current day from API-Football once every 5 minutes during non-match hours.
2. WHILE a match is live, THE Poller SHALL fetch match events from API-Football at an interval not exceeding 60 seconds.
3. THE Event_Processor SHALL store a fingerprint of each processed Match_Event in Supabase, comprising match ID, event type, event minute, and player/team name.
4. WHEN a fetched event's fingerprint already exists in Supabase, THE Event_Processor SHALL discard the event without generating commentary.
5. THE Event_Processor SHALL process new Match_Events in the order they are returned by API-Football.
6. IF the API-Football free tier rate limit is reached, THEN THE Poller SHALL pause polling for that match for 30 seconds before retrying.

---

### Requirement 10: Backend Data Persistence

**User Story:** As a system operator, I want all user, subscription, and event data stored reliably, so that the system can recover from restarts without data loss.

#### Acceptance Criteria

1. THE System SHALL persist User records in Supabase, including Telegram ID, language preference, subscription tier, and subscription expiry date.
2. THE System SHALL persist all Match_Event fingerprints in Supabase to support deduplication across restarts.
3. THE System SHALL persist all active match subscriptions, mapping User ID to match ID, in Supabase.
4. THE System SHALL persist all generated commentary updates in Supabase, including match ID, event type, language, content, and timestamp.
5. THE System SHALL persist Sponsor_Message records in Supabase, including sponsor name, message content, active start date, and active end date.
6. WHEN the backend process restarts, THE System SHALL reload active match subscriptions and in-progress match state from Supabase within 30 seconds.

---

### Requirement 11: White-Label API

**User Story:** As a third-party publisher (cricket blog, football news site), I want access to a commentary API, so that I can embed MatchCast AI commentary in my own product.

#### Acceptance Criteria

1. THE White_Label_API SHALL expose a REST endpoint that returns the latest commentary updates for a given match ID in a specified language.
2. WHEN a request is received by the White_Label_API, THE White_Label_API SHALL authenticate the request using an API key stored in Supabase.
3. IF a request is received with an invalid or missing API key, THEN THE White_Label_API SHALL return HTTP 401 with a descriptive error message.
4. THE White_Label_API SHALL enforce a rate limit of 60 requests per minute per API key.
5. IF a request exceeds the rate limit, THEN THE White_Label_API SHALL return HTTP 429 with a Retry-After header.
6. THE White_Label_API SHALL return responses in JSON format conforming to a documented schema.

---

### Requirement 12: Payments and Billing

**User Story:** As a user, I want to pay for my premium subscription securely, so that my account is upgraded without manual intervention.

#### Acceptance Criteria

1. WHEN a User initiates a premium subscription, THE System SHALL create a Razorpay order and return a payment link to the User.
2. WHEN Razorpay calls the System's payment webhook with a `payment.captured` event, THE Subscription_Manager SHALL verify the webhook signature before processing.
3. WHEN a verified payment is received, THE Subscription_Manager SHALL activate the premium subscription within 60 seconds and send a confirmation message to the User via the Bot.
4. THE System SHALL store each payment record in Supabase, including Razorpay order ID, payment ID, amount, currency, and timestamp.
5. IF a payment fails or is refunded, THEN THE Subscription_Manager SHALL not activate or SHALL deactivate the premium tier for the associated User.
6. THE System SHALL support monthly recurring subscriptions via Razorpay subscriptions, auto-renewing until cancelled by the User.

