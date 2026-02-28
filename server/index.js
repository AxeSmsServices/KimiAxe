/**
 * KimiAxe — Express Server
 * Serves static HTML files and provides API endpoints
 * Routes are split per platform: axesms, axesocials, axexvx, axeb2bai, axeb2bwallet
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const updateRoutes = require('./routes/updates');
const { startDailyDigestScheduler } = require('./jobs/dailyDigestJob');
const { initTelegramBot } = require('./tgBot');

// ---- PLATFORM ROUTES ----
const axeSMSRoutes = require('./routes/axesms');
const axeSocialsRoutes = require('./routes/axesocials');
const axeXVXRoutes = require('./routes/axexvx');
const axeB2BAIRoutes = require('./routes/axeb2bai');
const axeB2BWalletRoutes = require('./routes/axeb2bwallet');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- MIDDLEWARE ----
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for HTML pages
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..')));

// ---- API ROUTES ----

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ---- PLATFORM-SPECIFIC ROUTES ----
app.use('/api/sms', axeSMSRoutes);
app.use('/api/socials', axeSocialsRoutes);
app.use('/api/links', axeXVXRoutes);
app.use('/api/ai', axeB2BAIRoutes);
app.use('/api/wallet', axeB2BWalletRoutes);
app.use('/api/updates', updateRoutes);

// ---- AUTH ROUTES ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, hash, phone || null]
    );
    res.status(201).json({ message: 'Account created successfully.', user: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const user = result.rows[0];
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'kimiaxe_secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- CONTACT / WAITLIST ----
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message, platform } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    await db.query(
      'INSERT INTO contact_submissions (name, email, message, platform) VALUES ($1, $2, $3, $4)',
      [name, email, message, platform || 'general']
    );
    res.json({ message: 'Thank you! We will get back to you soon.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/waitlist', async (req, res) => {
  try {
    const { email, platform } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const existing = await db.query('SELECT id FROM waitlist WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.json({ message: 'You are already on the waitlist!' });
    }
    await db.query(
      'INSERT INTO waitlist (email, platform) VALUES ($1, $2)',
      [email, platform || 'general']
    );
    res.json({ message: 'You have been added to the waitlist!' });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- WALLET ROUTES ----
app.get('/api/wallet/balance', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT balance, currency FROM wallets WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.json({ balance: 0, currency: 'INR' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Wallet balance error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/wallet/transactions', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const result = await db.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    res.json({ transactions: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- SMS ROUTES ----
app.post('/api/sms/send', requireAuth, async (req, res) => {
  try {
    const { to, message, sender_id, schedule } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient and message are required.' });
    }
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await db.query(
      'INSERT INTO sms_messages (user_id, message_id, recipient, message, sender_id, status, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, messageId, to, message, sender_id || 'KIMIAXE', 'queued', schedule || null]
    );
    res.json({ status: 'queued', message_id: messageId });
  } catch (err) {
    console.error('SMS send error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- LINK SHORTENER ROUTES ----
app.post('/api/links/shorten', async (req, res) => {
  try {
    const { url, custom_slug, expires_at, password } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required.' });
    }
    const slug = custom_slug || Math.random().toString(36).substr(2, 7);
    const existing = await db.query('SELECT id FROM short_links WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Slug already taken.' });
    }
    const result = await db.query(
      'INSERT INTO short_links (user_id, original_url, slug, expires_at, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, slug',
      [req.user?.id || null, url, slug, expires_at || null, password || null]
    );
    const shortUrl = `${process.env.BASE_URL || 'https://axexvx.link'}/${slug}`;
    res.json({ short_url: shortUrl, slug: result.rows[0].slug });
  } catch (err) {
    console.error('Link shorten error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/links/:slug/stats', requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const link = await db.query('SELECT * FROM short_links WHERE slug = $1 AND user_id = $2', [slug, req.user.id]);
    if (link.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    const clicks = await db.query(
      'SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_clicks FROM link_clicks WHERE link_id = $1',
      [link.rows[0].id]
    );
    res.json({ link: link.rows[0], stats: clicks.rows[0] });
  } catch (err) {
    console.error('Link stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Short link redirect
app.get('/:slug', async (req, res, next) => {
  const { slug } = req.params;
  // Skip if it's an HTML file or known route
  if (slug.includes('.') || slug.startsWith('api')) return next();
  try {
    const result = await db.query(
      'SELECT * FROM short_links WHERE slug = $1 AND (expires_at IS NULL OR expires_at > NOW())',
      [slug]
    );
    if (result.rows.length === 0) return next();
    const link = result.rows[0];
    // Log click
    await db.query(
      'INSERT INTO link_clicks (link_id, ip_address, user_agent, referer) VALUES ($1, $2, $3, $4)',
      [link.id, req.ip, req.headers['user-agent'] || '', req.headers['referer'] || '']
    );
    // Update click count
    await db.query('UPDATE short_links SET click_count = click_count + 1 WHERE id = $1', [link.id]);
    res.redirect(301, link.original_url);
  } catch (err) {
    next();
  }
});

// ---- MIDDLEWARE HELPERS ----
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kimiaxe_secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ---- 404 HANDLER ----
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---- ERROR HANDLER ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log(`🚀 KimiAxe server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start background automations
  startDailyDigestScheduler();
  initTelegramBot();
});

module.exports = app;
