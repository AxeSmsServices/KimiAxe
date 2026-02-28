'use strict';

const db = require('./db');

async function logPublish(channel, status, messageBody, payload = {}, errorMessage = null) {
  await db.query(
    `INSERT INTO update_publish_logs (channel, post_type, message_body, payload, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [channel, 'daily-digest', messageBody, JSON.stringify(payload), status, errorMessage]
  );
}

async function publishToDiscord(message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    return { ok: false, skipped: true, reason: 'DISCORD_WEBHOOK_URL not set' };
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord publish failed: ${res.status} ${body}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function publishToTwitter(message) {
  const endpoint = process.env.TWITTER_PUBLISH_WEBHOOK;
  if (!endpoint) {
    return { ok: false, skipped: true, reason: 'TWITTER_PUBLISH_WEBHOOK not set' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Twitter publish failed: ${res.status} ${body}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function publishUpdateDigest(message) {
  const channels = [];

  const { broadcastToPrimaryChat } = require('./tgBot');
  const telegram = await broadcastToPrimaryChat(message);
  channels.push({ channel: 'telegram', ...telegram });

  const discord = await publishToDiscord(message);
  channels.push({ channel: 'discord', ...discord });

  const twitter = await publishToTwitter(message);
  channels.push({ channel: 'twitter', ...twitter });

  const ok = channels.some((c) => c.ok);
  const fail = channels.filter((c) => c.error).map((c) => `${c.channel}: ${c.error}`).join(' | ');

  await logPublish('social-bot', ok ? 'success' : 'failed', message, { channels }, fail || null);

  return { ok, channels };
}

module.exports = {
  publishUpdateDigest,
};
