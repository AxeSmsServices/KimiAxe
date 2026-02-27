/**
 * AxeSocials — API Routes
 * Handles social media scheduling, publishing, and analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ---- CONNECTED ACCOUNTS ----
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, platform, username, profile_url, followers, status, connected_at FROM social_accounts WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    console.error('Social accounts error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/accounts/connect', requireAuth, async (req, res) => {
  try {
    const { platform, access_token, username, profile_url } = req.body;
    if (!platform || !access_token) {
      return res.status(400).json({ error: 'Platform and access token are required.' });
    }

    const existing = await db.query(
      'SELECT id FROM social_accounts WHERE user_id = $1 AND platform = $2',
      [req.user.id, platform]
    );

    if (existing.rows.length > 0) {
      // Update existing connection
      await db.query(
        'UPDATE social_accounts SET access_token = $1, username = $2, profile_url = $3, status = $4 WHERE user_id = $5 AND platform = $6',
        [access_token, username || '', profile_url || '', 'active', req.user.id, platform]
      );
    } else {
      await db.query(
        `INSERT INTO social_accounts (user_id, platform, access_token, username, profile_url, status) 
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [req.user.id, platform, access_token, username || '', profile_url || '']
      );
    }

    res.json({ message: `${platform} connected successfully.` });
  } catch (err) {
    console.error('Social connect error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/accounts/:platform', requireAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM social_accounts WHERE user_id = $1 AND platform = $2',
      [req.user.id, req.params.platform]
    );
    res.json({ message: `${req.params.platform} disconnected.` });
  } catch (err) {
    console.error('Social disconnect error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- POSTS ----
router.post('/posts', requireAuth, async (req, res) => {
  try {
    const { content, platforms, media_urls, schedule_at, hashtags } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Post content is required.' });
    }
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'At least one platform is required.' });
    }

    const postId = 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const status = schedule_at ? 'scheduled' : 'queued';

    const result = await db.query(
      `INSERT INTO social_posts 
       (user_id, post_id, content, platforms, media_urls, hashtags, status, scheduled_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id,
        postId,
        content,
        JSON.stringify(platforms),
        JSON.stringify(media_urls || []),
        JSON.stringify(hashtags || []),
        status,
        schedule_at || null,
      ]
    );

    res.status(201).json({
      post: result.rows[0],
      message: schedule_at ? `Post scheduled for ${schedule_at}` : 'Post queued for publishing.',
    });
  } catch (err) {
    console.error('Social post error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/posts', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, platform } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM social_posts WHERE user_id = $1';
    const params = [req.user.id];
    let paramIdx = 2;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (platform) {
      query += ` AND platforms::text LIKE $${paramIdx++}`;
      params.push(`%${platform}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ posts: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Social posts list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/posts/:postId', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM social_posts WHERE post_id = $1 AND user_id = $2 RETURNING id',
      [req.params.postId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    res.json({ message: 'Post deleted.' });
  } catch (err) {
    console.error('Social post delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- ANALYTICS ----
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { platform, days = 30 } = req.query;

    let query = `
      SELECT 
        platform,
        SUM(impressions) as total_impressions,
        SUM(engagements) as total_engagements,
        SUM(clicks) as total_clicks,
        SUM(shares) as total_shares,
        AVG(engagement_rate) as avg_engagement_rate
      FROM social_analytics 
      WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'
    `;
    const params = [req.user.id];

    if (platform) {
      query += ' AND platform = $2';
      params.push(platform);
    }

    query += ' GROUP BY platform';

    const result = await db.query(query, params);
    res.json({ analytics: result.rows, period_days: parseInt(days) });
  } catch (err) {
    console.error('Social analytics error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- HASHTAG SUGGESTIONS ----
router.post('/hashtags/suggest', requireAuth, async (req, res) => {
  try {
    const { content, platform = 'instagram' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required for hashtag suggestions.' });
    }

    // Simple keyword-based suggestions (production would use AI/ML)
    const keywords = content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const suggestions = keywords.slice(0, 5).map(k => '#' + k.replace(/[^a-z0-9]/g, ''));

    const trending = ['#trending', '#viral', '#explore', '#fyp', '#reels'];
    const all = [...new Set([...suggestions, ...trending])].slice(0, 15);

    res.json({ hashtags: all, platform });
  } catch (err) {
    console.error('Hashtag suggest error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- CONTENT CALENDAR ----
router.get('/calendar', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth() + 1) - 1, 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const result = await db.query(
      `SELECT post_id, content, platforms, status, scheduled_at 
       FROM social_posts 
       WHERE user_id = $1 AND scheduled_at BETWEEN $2 AND $3
       ORDER BY scheduled_at ASC`,
      [req.user.id, startDate.toISOString(), endDate.toISOString()]
    );

    res.json({ posts: result.rows, month: startDate.getMonth() + 1, year: startDate.getFullYear() });
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
