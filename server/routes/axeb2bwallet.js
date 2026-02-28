/**
 * AxeB2B Wallet — API Routes
 * Handles wallet, payments, eSIM, domain, and B2B services
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ---- WALLET BALANCE ----
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT balance, currency, locked_balance FROM wallets WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      // Auto-create wallet
      const newWallet = await db.query(
        `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0, 'INR') RETURNING balance, currency, locked_balance`,
        [req.user.id]
      );
      return res.json(newWallet.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Wallet balance error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- TRANSACTIONS ----
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.user.id];
    let paramIdx = 2;

    if (type) {
      query += ` AND type = $${paramIdx++}`;
      params.push(type);
    }
    if (category) {
      query += ` AND category = $${paramIdx++}`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const total = await db.query('SELECT COUNT(*) FROM transactions WHERE user_id = $1', [req.user.id]);

    res.json({
      transactions: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- ADD MONEY / TOP-UP ----
router.post('/topup', requireAuth, async (req, res) => {
  try {
    const { amount, payment_method, payment_id } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Minimum top-up amount is ₹100.' });
    }
    if (amount > 100000) {
      return res.status(400).json({ error: 'Maximum top-up amount is ₹1,00,000 per transaction.' });
    }

    // In production, verify payment with gateway (Razorpay/Stripe)
    // const verified = await verifyPayment(payment_method, payment_id, amount);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update wallet balance
      await client.query(
        `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, $2, 'INR')
         ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $2`,
        [req.user.id, amount]
      );

      // Record transaction
      const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await client.query(
        `INSERT INTO transactions (user_id, txn_id, type, amount, currency, description, payment_method, payment_id, status) 
         VALUES ($1, $2, 'credit', $3, 'INR', 'Wallet Top-up', $4, $5, 'completed')`,
        [req.user.id, txnId, amount, payment_method || 'unknown', payment_id || null]
      );

      await client.query('COMMIT');
      res.json({ message: `₹${amount} added to your wallet.`, txn_id: txnId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Top-up error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- ESIM SERVICES ----
router.get('/esim/plans', async (req, res) => {
  try {
    const { country } = req.query;
    let query = 'SELECT * FROM esim_plans WHERE is_active = true';
    const params = [];

    if (country) {
      query += ' AND country_code = $1';
      params.push(country.toUpperCase());
    }

    query += ' ORDER BY price ASC';
    const result = await db.query(query, params);
    res.json({ plans: result.rows });
  } catch (err) {
    console.error('eSIM plans error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/esim/purchase', requireAuth, async (req, res) => {
  try {
    const { plan_id, country_code } = req.body;
    if (!plan_id || !country_code) {
      return res.status(400).json({ error: 'Plan ID and country code are required.' });
    }

    // Get plan details
    const plan = await db.query('SELECT * FROM esim_plans WHERE id = $1 AND is_active = true', [plan_id]);
    if (plan.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    const planData = plan.rows[0];

    // Check wallet balance
    const wallet = await db.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
    const balance = parseFloat(wallet.rows[0]?.balance || 0);

    if (balance < planData.price) {
      return res.status(402).json({ error: 'Insufficient wallet balance.' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Deduct from wallet
      await client.query(
        'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
        [planData.price, req.user.id]
      );

      // Create eSIM order
      const orderId = 'esim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const result = await client.query(
        `INSERT INTO esim_orders (user_id, order_id, plan_id, country_code, status, activation_code) 
         VALUES ($1, $2, $3, $4, 'processing', $5) RETURNING *`,
        [req.user.id, orderId, plan_id, country_code.toUpperCase(), 'QR_' + Math.random().toString(36).substr(2, 16).toUpperCase()]
      );

      // Record transaction
      const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await client.query(
        `INSERT INTO transactions (user_id, txn_id, type, amount, currency, description, category, status) 
         VALUES ($1, $2, 'debit', $3, 'INR', $4, 'esim', 'completed')`,
        [req.user.id, txnId, planData.price, `eSIM — ${country_code} ${planData.data_gb}GB`]
      );

      await client.query('COMMIT');
      res.status(201).json({
        order: result.rows[0],
        message: 'eSIM purchased! Check your email for activation QR code.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('eSIM purchase error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- DOMAIN SERVICES ----
router.post('/domain/search', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain name is required.' });
    }

    const tlds = ['.com', '.in', '.net', '.org', '.io', '.co'];
    const prices = { '.com': 899, '.in': 499, '.net': 799, '.org': 699, '.io': 2499, '.co': 1299 };

    // In production, check actual domain availability via registrar API
    const results = tlds.map(tld => ({
      domain: domain.toLowerCase().replace(/\.[^.]+$/, '') + tld,
      tld,
      available: Math.random() > 0.3,
      price: prices[tld],
      currency: 'INR',
    }));

    res.json({ results, searched_domain: domain });
  } catch (err) {
    console.error('Domain search error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/domain/register', requireAuth, async (req, res) => {
  try {
    const { domain, years = 1 } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain name is required.' });
    }

    // Mock pricing
    const tld = '.' + domain.split('.').pop();
    const prices = { '.com': 899, '.in': 499, '.net': 799, '.org': 699, '.io': 2499, '.co': 1299 };
    const price = (prices[tld] || 999) * years;

    // Check wallet balance
    const wallet = await db.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
    const balance = parseFloat(wallet.rows[0]?.balance || 0);

    if (balance < price) {
      return res.status(402).json({ error: 'Insufficient wallet balance.' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [price, req.user.id]);

      const orderId = 'dom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + years);

      const result = await client.query(
        `INSERT INTO domain_orders (user_id, order_id, domain, years, price, expires_at, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
        [req.user.id, orderId, domain.toLowerCase(), years, price, expiresAt.toISOString()]
      );

      const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await client.query(
        `INSERT INTO transactions (user_id, txn_id, type, amount, currency, description, category, status) 
         VALUES ($1, $2, 'debit', $3, 'INR', $4, 'domain', 'completed')`,
        [req.user.id, txnId, price, `Domain: ${domain} (${years} year${years > 1 ? 's' : ''})`]
      );

      await client.query('COMMIT');
      res.status(201).json({ order: result.rows[0], message: `${domain} registered successfully!` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Domain register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- PAYMENT INITIATION (Razorpay/Stripe) ----
router.post('/payment/create-order', requireAuth, async (req, res) => {
  try {
    const { amount, currency = 'INR', purpose } = req.body;
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Minimum amount is ₹100.' });
    }

    const gateway = process.env.PAYMENT_GATEWAY || 'razorpay';

    // In production, create actual payment order
    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    res.json({
      order_id: orderId,
      amount,
      currency,
      gateway,
      key: gateway === 'razorpay' ? process.env.RAZORPAY_KEY_ID : process.env.STRIPE_SECRET_KEY,
      message: `Payment order created via ${gateway}.`,
    });
  } catch (err) {
    console.error('Payment create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/payment/verify', requireAuth, async (req, res) => {
  try {
    const { order_id, payment_id, signature, amount } = req.body;

    // In production, verify signature with Razorpay/Stripe
    // const isValid = verifyRazorpaySignature(order_id, payment_id, signature);

    if (!payment_id) {
      return res.status(400).json({ error: 'Payment ID is required.' });
    }

    // Credit wallet after successful payment
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, $2, 'INR')
         ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $2`,
        [req.user.id, amount]
      );

      const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await client.query(
        `INSERT INTO transactions (user_id, txn_id, type, amount, currency, description, payment_id, status) 
         VALUES ($1, $2, 'credit', $3, 'INR', 'Wallet Top-up', $4, 'completed')`,
        [req.user.id, txnId, amount, payment_id]
      );

      await client.query('COMMIT');
      res.json({ verified: true, txn_id: txnId, message: 'Payment verified and wallet credited.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
