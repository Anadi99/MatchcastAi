import TelegramBot from 'node-telegram-bot-api';
import { upsertUser, getUserByTelegramId } from '../db/users';
import { getTodayMatches } from '../db/matches';
import { addSubscription, removeSubscription, getSubscriptionsForUser } from '../db/subscriptions';
import { supabase } from '../db/client';
import type { Language } from '../types/db';

// Lazy import to avoid circular dependency (subscriptions imports sendMessage from bot)
// createOrder is imported inline inside the handler below.

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing environment variable: TELEGRAM_BOT_TOKEN');
}

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

/**
 * Send a text message to a Telegram user identified by their numeric ID.
 */
export async function sendMessage(telegramId: number, text: string): Promise<void> {
  await bot.sendMessage(telegramId, text);
}

// ─── Language selection keyboard ────────────────────────────────────────────

const LANGUAGE_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🇮🇳 हिंदी', callback_data: 'lang_hi' },
      { text: '🌺 தமிழ்', callback_data: 'lang_ta' },
    ],
    [
      { text: '⚡ తెలుగు', callback_data: 'lang_te' },
      { text: '🎪 मराठी', callback_data: 'lang_mr' },
    ],
  ],
};

const WELCOME_MESSAGE =
  '🏆 MatchCast AI — World Cup 2026\n\nLive football commentary in your language. Pick your language to start:';

// Language confirmation messages keyed by language code
const LANG_CONFIRMATION: Record<Language, string> = {
  hi: '✅ हिंदी सेट हो गया!\n\nअब एक मैच चुनें:\n/matches — लाइव और आने वाले मैच\n/help — सभी कमांड',
  ta: '✅ தமிழ் அமைக்கப்பட்டது!\n\n/matches — நேரடி போட்டிகள்\n/help — அனைத்து கட்டளைகள்',
  te: '✅ తెలుగు సెట్ అయింది!\n\n/matches — లైవ్ మ్యాచ్‌లు\n/help — అన్ని కమాండ్‌లు',
  mr: '✅ मराठी सेट झाली!\n\n/matches — लाइव्ह सामने\n/help — सर्व कमांड',
};

const CALLBACK_TO_LANGUAGE: Record<string, Language> = {
  lang_hi: 'hi',
  lang_ta: 'ta',
  lang_te: 'te',
  lang_mr: 'mr',
};

const HELP_TEXT = `🏆 MatchCast AI — Commands:
/start — Get started
/language — Change language
/matches — View today's matches
/subscribe <match_id> — Subscribe to a match
/unsubscribe <match_id> — Unsubscribe from a match
/status — Your profile & subscriptions
/premium — Upgrade to premium ₹99/month
/help — Show this message`;

const NOT_STARTED_MSG = 'Please start with /start to set your language first.';

// ─── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, WELCOME_MESSAGE, { reply_markup: LANGUAGE_KEYBOARD });
});

// ─── Callback query handler (language selection) ─────────────────────────────

bot.on('callback_query', async (query) => {
  const data = query.data ?? '';
  const language = CALLBACK_TO_LANGUAGE[data];

  if (!language) {
    // Not a language callback — ignore
    await bot.answerCallbackQuery(query.id);
    return;
  }

  const telegramId = query.from.id;

  try {
    await upsertUser(telegramId, language);
    const confirmText = LANG_CONFIRMATION[language];
    await bot.sendMessage(telegramId, confirmText);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: 'Language callback error', err }));
    await bot.sendMessage(telegramId, 'Something went wrong. Please try again.');
  }

  // Dismiss the loading spinner on the button
  await bot.answerCallbackQuery(query.id);
});

// ─── /language ───────────────────────────────────────────────────────────────

bot.onText(/\/language/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, WELCOME_MESSAGE, { reply_markup: LANGUAGE_KEYBOARD });
});

// ─── /help ───────────────────────────────────────────────────────────────────

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, HELP_TEXT);
});

// ─── /status ─────────────────────────────────────────────────────────────────

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, NOT_STARTED_MSG);
    return;
  }

  try {
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await bot.sendMessage(chatId, 'Please start with /start');
      return;
    }

    const subscriptions = await getSubscriptionsForUser(user.id);

    const tierLabel = user.tier === 'premium' ? 'Premium ⭐' : 'Free';
    const langLabel: Record<Language, string> = {
      hi: 'हिंदी',
      ta: 'தமிழ்',
      te: 'తెలుగు',
      mr: 'मराठी',
    };

    let statusText = `👤 Your Profile\n\nLanguage: ${langLabel[user.language]}\nTier: ${tierLabel}\n\n`;

    if (subscriptions.length === 0) {
      statusText += '📋 No active subscriptions.\nUse /matches to browse and subscribe.';
    } else {
      statusText += `📋 Subscribed matches (${subscriptions.length}):\n`;
      for (const match of subscriptions) {
        statusText += `• ${match.home_team} vs ${match.away_team}\n`;
      }
    }

    await bot.sendMessage(chatId, statusText);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: '/status error', err }));
    await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// ─── /matches ────────────────────────────────────────────────────────────────

bot.onText(/\/matches/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, NOT_STARTED_MSG);
    return;
  }

  try {
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await bot.sendMessage(chatId, NOT_STARTED_MSG);
      return;
    }

    const matches = await getTodayMatches();

    if (matches.length === 0) {
      await bot.sendMessage(chatId, 'No matches today. Check back later!');
      return;
    }

    const lines = matches.map(
      (m) => `🏟️ ${m.home_team} vs ${m.away_team} | ${m.status} | ID: ${m.fixture_id}`
    );
    await bot.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: '/matches error', err }));
    await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// ─── /subscribe <match_id> ───────────────────────────────────────────────────

bot.onText(/\/subscribe(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, NOT_STARTED_MSG);
    return;
  }

  try {
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await bot.sendMessage(chatId, NOT_STARTED_MSG);
      return;
    }

    const matchIdStr = match?.[1]?.trim();
    const matchId = matchIdStr ? parseInt(matchIdStr, 10) : NaN;

    if (isNaN(matchId)) {
      await bot.sendMessage(chatId, 'Usage: /subscribe <match_id>\nUse /matches to see match IDs.');
      return;
    }

    const { data, error } = await supabase
      .from('matches')
      .select()
      .eq('fixture_id', matchId)
      .single();

    if (error || !data) {
      await bot.sendMessage(chatId, `Match ID ${matchId} not found. Use /matches to see available matches.`);
      return;
    }

    await addSubscription(user.id, data.id);
    await bot.sendMessage(
      chatId,
      `✅ Subscribed! You'll get live commentary for ${data.home_team} vs ${data.away_team}`
    );
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: '/subscribe error', err }));
    await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// ─── /unsubscribe <match_id> ─────────────────────────────────────────────────

bot.onText(/\/unsubscribe(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, NOT_STARTED_MSG);
    return;
  }

  try {
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      await bot.sendMessage(chatId, NOT_STARTED_MSG);
      return;
    }

    const matchIdStr = match?.[1]?.trim();
    const matchId = matchIdStr ? parseInt(matchIdStr, 10) : NaN;

    if (isNaN(matchId)) {
      await bot.sendMessage(chatId, 'Usage: /unsubscribe <match_id>\nUse /matches to see match IDs.');
      return;
    }

    const { data, error } = await supabase
      .from('matches')
      .select()
      .eq('fixture_id', matchId)
      .single();

    if (error || !data) {
      await bot.sendMessage(chatId, `Match ID ${matchId} not found. Use /matches to see available matches.`);
      return;
    }

    await removeSubscription(user.id, data.id);
    await bot.sendMessage(chatId, `✅ Unsubscribed from ${data.home_team} vs ${data.away_team}`);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: '/unsubscribe error', err }));
    await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// ─── /premium ────────────────────────────────────────────────────────────────

bot.onText(/\/premium/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    await bot.sendMessage(chatId, NOT_STARTED_MSG);
    return;
  }

  try {
    // Dynamic import to avoid circular dependency
    const { createOrder } = await import('../subscriptions');
    const { orderId, checkoutUrl } = await createOrder(telegramId);

    const text =
      `⭐ MatchCast Premium — ₹99/month\n\n` +
      `✅ All 4 languages (Hindi, Tamil, Telugu, Marathi)\n` +
      `✅ No ads or sponsor messages\n` +
      `✅ Pre-match reports (30 min before kick-off)\n` +
      `✅ Post-match summaries\n\n` +
      `💳 Pay securely via Razorpay:\n${checkoutUrl}\n\n` +
      `Order ID: ${orderId}\n` +
      `Your subscription activates instantly after payment.`;

    await bot.sendMessage(chatId, text, { disable_web_page_preview: true } as TelegramBot.SendMessageOptions);
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: '/premium error', err }));
    await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// ─── Fallback for unrecognised messages ──────────────────────────────────────

bot.on('message', async (msg) => {
  // Skip messages that are commands (already handled above)
  if (msg.text?.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Unknown command. Type /help to see all commands.');
});
