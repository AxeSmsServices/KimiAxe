'use strict';

const { Telegraf } = require('telegraf');
const db = require('./db');
const { getDigestData, formatDigestMessage } = require('./services/updateDigest');
const { runDailyDigest } = require('./jobs/dailyDigestJob');

let botInstance = null;

function isAdmin(ctx) {
  const allow = (process.env.TG_ADMIN_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!allow.length) return true;
  return allow.includes(String(ctx.from?.id || ''));
}

async function sendDigest(ctx) {
  const digest = await getDigestData(new Date());
  const message = formatDigestMessage(digest);
  await ctx.reply(message, { disable_web_page_preview: true });
}

async function registerCommands(bot) {
  bot.start((ctx) => ctx.reply('KimiAxe Update Bot active. Commands: /digest /publish_now /status'));

  bot.command('status', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Not authorized.');
    const today = new Date().toISOString().slice(0, 10);
    const logs = await db.query(
      `SELECT channel, status, published_at
         FROM update_publish_logs
        WHERE published_at::date = $1::date
        ORDER BY published_at DESC
        LIMIT 20`,
      [today]
    );

    const lines = logs.rows.length
      ? logs.rows.map((l) => `• ${l.channel} — ${l.status} — ${new Date(l.published_at).toISOString()}`).join('\n')
      : 'No publish logs today.';

    return ctx.reply(`Daily publish status (${today})\n${lines}`);
  });

  bot.command('digest', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Not authorized.');
    await sendDigest(ctx);
  });

  bot.command('publish_now', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('Not authorized.');
    const result = await runDailyDigest(true);
    await ctx.reply(`Manual publish done. Success: ${result.publishResult?.ok ? 'yes' : 'no'}`);
  });
}

async function broadcastToPrimaryChat(message) {
  if (!botInstance) return { ok: false, reason: 'bot not initialized' };
  const chatId = process.env.TG_CHAT_ID;
  if (!chatId) return { ok: false, reason: 'TG_CHAT_ID not set' };

  try {
    await botInstance.telegram.sendMessage(chatId, message, { disable_web_page_preview: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function initTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log('ℹ️ BOT_TOKEN not set, Telegram bot disabled');
    return null;
  }

  if (botInstance) return botInstance;
  const bot = new Telegraf(token);
  registerCommands(bot).catch((err) => console.error('TG register commands error:', err.message));
  bot.launch().then(() => console.log('🤖 Telegram bot running')).catch((err) => {
    console.error('Telegram launch error:', err.message);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  botInstance = bot;
  return bot;
}

module.exports = {
  initTelegramBot,
  broadcastToPrimaryChat,
};

