/**
 * AxeSMS — API Routes
 * Handles SMS, Email, WhatsApp, and Virtual Number endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ---- SEND SMS ----
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, message, sender_id, schedule, channel = 'sms' } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient and message are required.' });
    }

    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    await db.query(
      `INSERT INTO sms_messages 
       (user_id, message_id, recipient, message, sender_id, channel, status, scheduled_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user.id, messageId, to, message, sender_id || 'KIMIAXE', channel, 'queued', schedule || null]
    );

    res.json({ status: 'queued', message_id: messageId, channel });
  } catch (err) {
    console.error('SMS send error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- SEND BULK SMS ----
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { recipients, message, sender_id, schedule } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (recipients.length > 10000) {
      return res.status(400).json({ error: 'Maximum 10,000 recipients per bulk send.' });
    }

    const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Insert all messages in a single transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const recipient of recipients) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await client.query(
          `INSERT INTO sms_messages 
           (user_id, message_id, batch_id, recipient, message, sender_id, status, scheduled_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.user.id, messageId, batchId, recipient, message, sender_id || 'KIMIAXE', 'queued', schedule || null]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      status: 'queued',
      batch_id: batchId,
      total: recipients.length,
      message: `${recipients.length} messages queued successfully.`,
    });
  } catch (err) {
    console.error('Bulk SMS error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- GET MESSAGE STATUS ----
router.get('/status/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await db.query(
      'SELECT * FROM sms_messages WHERE message_id = $1 AND user_id = $2',
      [messageId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('SMS status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- GET MESSAGE HISTORY ----
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, channel, status } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM sms_messages WHERE user_id = $1';
    const params = [req.user.id];
    let paramIdx = 2;

    if (channel) {
      query += ` AND channel = $${paramIdx++}`;
      params.push(channel);
    }
    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ messages: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('SMS history error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- VIRTUAL NUMBERS ----
router.get('/virtual-numbers', requireAuth, async (req, res) => {
  try {
    const { country } = req.query;
    let query = 'SELECT * FROM virtual_numbers WHERE user_id = $1';
    const params = [req.user.id];

    if (country) {
      query += ' AND country_code = $2';
      params.push(country.toUpperCase());
    }

    const result = await db.query(query, params);
    res.json({ numbers: result.rows });
  } catch (err) {
    console.error('Virtual numbers error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/virtual-numbers/purchase', requireAuth, async (req, res) => {
  try {
    const { country_code, number_type = 'local' } = req.body;
    if (!country_code) {
      return res.status(400).json({ error: 'Country code is required.' });
    }

    // Generate a mock virtual number
    const number = '+' + Math.floor(Math.random() * 9000000000 + 1000000000);
    const result = await db.query(
      `INSERT INTO virtual_numbers (user_id, number, country_code, number_type, status) 
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [req.user.id, number, country_code.toUpperCase(), number_type]
    );

    res.status(201).json({ number: result.rows[0] });
  } catch (err) {
    console.error('Virtual number purchase error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- SMS ANALYTICS ----
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await db.query(
      `SELECT 
         COUNT(*) as total_sent,
         COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_count,
         COUNT(CASE WHEN channel = 'email' THEN 1 END) as email_count,
         COUNT(CASE WHEN channel = 'whatsapp' THEN 1 END) as whatsapp_count
       FROM sms_messages 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('SMS analytics error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- SENDER IDs ----
router.get('/sender-ids', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sender_ids WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ sender_ids: result.rows });
  } catch (err) {
    console.error('Sender IDs error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/sender-ids', requireAuth, async (req, res) => {
  try {
    const { sender_id, purpose } = req.body;
    if (!sender_id || sender_id.length < 3 || sender_id.length > 11) {
      return res.status(400).json({ error: 'Sender ID must be 3-11 characters.' });
    }

    const result = await db.query(
      `INSERT INTO sender_ids (user_id, sender_id, purpose, status) 
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [req.user.id, sender_id.toUpperCase(), purpose || '']
    );

    res.status(201).json({ sender_id: result.rows[0] });
  } catch (err) {
    console.error('Sender ID create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
