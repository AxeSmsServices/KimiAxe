/**
 * AxeXVX — API Routes
 * Handles link shortening, file hosting, QR codes, and analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// ---- SHORTEN LINK ----
router.post('/shorten', optionalAuth, async (req, res) => {
  try {
    const { url, custom_slug, expires_at, password, title } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required.' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const slug = custom_slug || Math.random().toString(36).substr(2, 7);

    // Check slug availability
    const existing = await db.query('SELECT id FROM short_links WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Slug already taken. Please choose another.' });
    }

    let passwordHash = null;
    if (password) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `INSERT INTO short_links (user_id, original_url, slug, title, expires_at, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, slug, original_url, title, created_at`,
      [req.user?.id || null, url, slug, title || null, expires_at || null, passwordHash]
    );

    const shortUrl = `${process.env.BASE_URL || 'https://axexvx.link'}/${slug}`;
    res.status(201).json({
      short_url: shortUrl,
      slug: result.rows[0].slug,
      original_url: result.rows[0].original_url,
      title: result.rows[0].title,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Link shorten error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- GET LINK INFO ----
router.get('/links/:slug', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM short_links WHERE slug = $1 AND user_id = $2',
      [req.params.slug, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Link info error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- LIST USER LINKS ----
router.get('/links', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT sl.*, 
         COUNT(lc.id) as total_clicks,
         COUNT(DISTINCT lc.ip_address) as unique_clicks
       FROM short_links sl
       LEFT JOIN link_clicks lc ON lc.link_id = sl.id
       WHERE sl.user_id = $1
       GROUP BY sl.id
       ORDER BY sl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ links: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Links list error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- DELETE LINK ----
router.delete('/links/:slug', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM short_links WHERE slug = $1 AND user_id = $2 RETURNING id',
      [req.params.slug, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    res.json({ message: 'Link deleted.' });
  } catch (err) {
    console.error('Link delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- LINK ANALYTICS ----
router.get('/links/:slug/analytics', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const link = await db.query(
      'SELECT * FROM short_links WHERE slug = $1 AND user_id = $2',
      [req.params.slug, req.user.id]
    );
    if (link.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }

    const linkId = link.rows[0].id;

    const [totals, daily, countries, devices] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_clicks
         FROM link_clicks WHERE link_id = $1`,
        [linkId]
      ),
      db.query(
        `SELECT DATE(clicked_at) as date, COUNT(*) as clicks
         FROM link_clicks 
         WHERE link_id = $1 AND clicked_at > NOW() - INTERVAL '${parseInt(days)} days'
         GROUP BY DATE(clicked_at) ORDER BY date`,
        [linkId]
      ),
      db.query(
        `SELECT country, COUNT(*) as clicks
         FROM link_clicks WHERE link_id = $1
         GROUP BY country ORDER BY clicks DESC LIMIT 10`,
        [linkId]
      ),
      db.query(
        `SELECT device_type, COUNT(*) as clicks
         FROM link_clicks WHERE link_id = $1
         GROUP BY device_type ORDER BY clicks DESC`,
        [linkId]
      ),
    ]);

    res.json({
      link: link.rows[0],
      totals: totals.rows[0],
      daily: daily.rows,
      countries: countries.rows,
      devices: devices.rows,
    });
  } catch (err) {
    console.error('Link analytics error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- FILE UPLOAD ----
router.post('/files/upload', requireAuth, async (req, res) => {
  try {
    const { filename, size, mime_type, storage_path } = req.body;

    if (!filename || !storage_path) {
      return res.status(400).json({ error: 'Filename and storage path are required.' });
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;
    if (size > maxSize) {
      return res.status(400).json({ error: `File too large. Max size is ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
    }

    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const slug = Math.random().toString(36).substr(2, 8);

    const result = await db.query(
      `INSERT INTO hosted_files (user_id, file_id, filename, size, mime_type, storage_path, slug) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, fileId, filename, size || 0, mime_type || 'application/octet-stream', storage_path, slug]
    );

    const fileUrl = `${process.env.BASE_URL || 'https://axexvx.link'}/f/${slug}`;
    res.status(201).json({ file: result.rows[0], url: fileUrl });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- QR CODE GENERATION ----
router.post('/qr/generate', optionalAuth, async (req, res) => {
  try {
    const { url, size = 256, format = 'png', color = '#000000', bg_color = '#ffffff' } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required.' });
    }

    // In production, use a QR library like 'qrcode'
    // For now, return a placeholder response
    const qrId = 'qr_' + Date.now();
    res.json({
      qr_id: qrId,
      url,
      size,
      format,
      // In production: qr_image: base64EncodedQRImage
      message: 'QR code generated. Integrate qrcode npm package for actual image generation.',
    });
  } catch (err) {
    console.error('QR generate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- REDIRECT (handled in main server, but stats endpoint here) ----
router.get('/redirect/:slug/stats', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sl.slug, sl.original_url, sl.click_count,
         COUNT(lc.id) as total_clicks
       FROM short_links sl
       LEFT JOIN link_clicks lc ON lc.link_id = sl.id
       WHERE sl.slug = $1
       GROUP BY sl.id`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Redirect stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
