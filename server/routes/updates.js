'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getDigestData, formatDigestMessage } = require('../services/updateDigest');
const { runDailyDigest } = require('../jobs/dailyDigestJob');

router.get('/sites', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT website_key, website_name, primary_domain, subdomains, category, status, description
         FROM website_registry
        ORDER BY website_name ASC`
    );
    res.json({ sites: result.rows });
  } catch (err) {
    console.error('Sites list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/digest', async (req, res) => {
  try {
    const digest = await getDigestData(new Date());
    const message = formatDigestMessage(digest);
    res.json({ ...digest, message });
  } catch (err) {
    console.error('Digest fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/updates', requireAuth, async (req, res) => {
  try {
    const {
      website_key,
      title,
      summary,
      details,
      update_type = 'feature',
      status = 'planned',
      target_date,
      released_at,
    } = req.body;

    if (!website_key || !title || !summary) {
      return res.status(400).json({ error: 'website_key, title and summary are required.' });
    }

    const exists = await db.query('SELECT website_key FROM website_registry WHERE website_key = $1', [website_key]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Website key not found in registry.' });
    }

    const result = await db.query(
      `INSERT INTO website_updates
       (website_key, title, summary, details, update_type, status, target_date, released_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        website_key,
        title,
        summary,
        details || null,
        update_type,
        status,
        target_date || null,
        released_at || null,
        req.user.email || req.user.id,
      ]
    );

    res.status(201).json({ update: result.rows[0] });
  } catch (err) {
    console.error('Create update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/updates', async (req, res) => {
  try {
    const { website_key, status, limit = 50 } = req.query;
    const params = [];
    const filters = [];

    if (website_key) {
      params.push(website_key);
      filters.push(`wu.website_key = $${params.length}`);
    }
    if (status) {
      params.push(status);
      filters.push(`wu.status = $${params.length}`);
    }

    params.push(parseInt(limit, 10));

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT wu.*, wr.website_name, wr.primary_domain
        FROM website_updates wu
        JOIN website_registry wr ON wr.website_key = wu.website_key
        ${where}
       ORDER BY COALESCE(wu.released_at, wu.target_date::timestamptz, wu.created_at) DESC
       LIMIT $${params.length}
    `;

    const result = await db.query(query, params);
    res.json({ updates: result.rows });
  } catch (err) {
    console.error('List updates error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/updates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, summary, details, update_type, status, target_date, released_at } = req.body;

    const result = await db.query(
      `UPDATE website_updates
          SET title = COALESCE($2, title),
              summary = COALESCE($3, summary),
              details = COALESCE($4, details),
              update_type = COALESCE($5, update_type),
              status = COALESCE($6, status),
              target_date = COALESCE($7, target_date),
              released_at = COALESCE($8, released_at)
        WHERE id = $1
      RETURNING *`,
      [id, title, summary, details, update_type, status, target_date, released_at]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Update not found.' });
    }

    res.json({ update: result.rows[0] });
  } catch (err) {
    console.error('Update patch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/digest/publish', requireAuth, async (_req, res) => {
  try {
    const result = await runDailyDigest(true);
    res.json(result);
  } catch (err) {
    console.error('Manual digest publish error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;

