'use strict';

const db = require('../db');
const { getDigestData, formatDigestMessage, toDateKey } = require('../services/updateDigest');
const { publishUpdateDigest } = require('../socialBot');

let lastRunDate = null;

function shouldRunNow(now = new Date()) {
  const schedule = process.env.DIGEST_SCHEDULE_UTC || '08:00';
  const [h, m] = schedule.split(':').map((n) => parseInt(n, 10));
  return now.getUTCHours() === h && now.getUTCMinutes() === m;
}

async function runDailyDigest(force = false) {
  const now = new Date();
  const dateKey = toDateKey(now);

  if (!force) {
    if (!shouldRunNow(now)) return { skipped: true, reason: 'outside schedule' };
    if (lastRunDate === dateKey) return { skipped: true, reason: 'already ran in memory' };
  }

  const existing = await db.query(
    `SELECT id
       FROM update_publish_logs
      WHERE channel = 'daily-job'
        AND post_type = 'daily-digest'
        AND published_at::date = $1::date
      LIMIT 1`,
    [dateKey]
  );

  if (!force && existing.rows.length > 0) {
    lastRunDate = dateKey;
    return { skipped: true, reason: 'already ran in db' };
  }

  const digest = await getDigestData(now);
  const message = formatDigestMessage(digest);
  const publishResult = await publishUpdateDigest(message);

  await db.query(
    `INSERT INTO update_publish_logs (channel, post_type, message_body, payload, status)
     VALUES ($1, $2, $3, $4, $5)`,
    ['daily-job', 'daily-digest', message, JSON.stringify(publishResult), publishResult.ok ? 'success' : 'failed']
  );

  lastRunDate = dateKey;
  return { skipped: false, digest, publishResult };
}

function startDailyDigestScheduler() {
  const checkMs = parseInt(process.env.DIGEST_CHECK_INTERVAL_MS || '60000', 10);

  setInterval(async () => {
    try {
      await runDailyDigest(false);
    } catch (err) {
      console.error('Daily digest scheduler error:', err.message);
    }
  }, checkMs);

  console.log('📅 Daily digest scheduler enabled');
}

module.exports = {
  runDailyDigest,
  startDailyDigestScheduler,
};

