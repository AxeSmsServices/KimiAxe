'use strict';

const db = require('../db');

function toDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function getDigestData(referenceDate = new Date()) {
  const dateKey = toDateKey(referenceDate);

  const [releasedToday, upcoming] = await Promise.all([
    db.query(
      `SELECT wu.id, wu.website_key, wu.title, wu.summary, wu.update_type, wu.released_at,
              wr.website_name, wr.primary_domain
         FROM website_updates wu
         JOIN website_registry wr ON wr.website_key = wu.website_key
        WHERE wu.status = 'released'
          AND wu.released_at::date = $1::date
        ORDER BY wu.released_at DESC`,
      [dateKey]
    ),
    db.query(
      `SELECT wu.id, wu.website_key, wu.title, wu.summary, wu.update_type, wu.target_date,
              wr.website_name, wr.primary_domain
         FROM website_updates wu
         JOIN website_registry wr ON wr.website_key = wu.website_key
        WHERE wu.status = 'planned'
          AND wu.target_date IS NOT NULL
          AND wu.target_date BETWEEN $1::date AND ($1::date + INTERVAL '7 day')
        ORDER BY wu.target_date ASC`,
      [dateKey]
    ),
  ]);

  return {
    dateKey,
    releasedToday: releasedToday.rows,
    upcoming: upcoming.rows,
  };
}

function formatDigestMessage(data) {
  const releasedLines = data.releasedToday.length
    ? data.releasedToday
        .map(
          (u) =>
            `✅ ${u.website_name} (${u.primary_domain})\n• ${u.title}\n• ${u.summary}`
        )
        .join('\n\n')
    : 'No releases shipped today.';

  const upcomingLines = data.upcoming.length
    ? data.upcoming
        .map(
          (u) =>
            `🗓️ ${u.target_date?.toISOString?.().slice(0, 10) || u.target_date} — ${u.website_name}\n• ${u.title}\n• ${u.summary}`
        )
        .join('\n\n')
    : 'No planned items in the next 7 days.';

  return [
    `🚀 KimiAxe Daily Product Digest (${data.dateKey})`,
    '',
    'Today Released:',
    releasedLines,
    '',
    'Coming Next (7 Days):',
    upcomingLines,
  ].join('\n');
}

module.exports = {
  getDigestData,
  formatDigestMessage,
  toDateKey,
};

