/**
 * AxeB2B AI — API Routes
 * Handles AI chat, content generation, and business tools
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ---- AI CHAT ----
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, model = 'gpt-4', conversation_id, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Check token usage limit
    const usage = await db.query(
      `SELECT SUM(tokens_used) as total FROM ai_usage 
       WHERE user_id = $1 AND created_at > DATE_TRUNC('month', NOW())`,
      [req.user.id]
    );
    const monthlyUsed = parseInt(usage.rows[0]?.total || 0);
    const monthlyLimit = 100000; // tokens per month

    if (monthlyUsed >= monthlyLimit) {
      return res.status(429).json({ error: 'Monthly token limit reached. Please upgrade your plan.' });
    }

    // In production, call OpenAI API here
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let aiResponse = '';
    let tokensUsed = 0;

    if (openaiApiKey) {
      // Real OpenAI call would go here
      // const openai = new OpenAI({ apiKey: openaiApiKey });
      // const completion = await openai.chat.completions.create({...});
      aiResponse = 'OpenAI integration ready. Set OPENAI_API_KEY in .env to enable.';
      tokensUsed = Math.ceil(message.length / 4);
    } else {
      // Fallback mock response
      aiResponse = `I understand you're asking about: "${message.substring(0, 50)}...". This is a demo response. Configure OPENAI_API_KEY for real AI responses.`;
      tokensUsed = Math.ceil(message.length / 4);
    }

    // Log usage
    const convId = conversation_id || 'conv_' + Date.now();
    await db.query(
      `INSERT INTO ai_usage (user_id, conversation_id, model, prompt, response, tokens_used) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, convId, model, message, aiResponse, tokensUsed]
    );

    res.json({
      response: aiResponse,
      conversation_id: convId,
      tokens_used: tokensUsed,
      model,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- CONTENT GENERATION ----
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { type, prompt, tone = 'professional', length = 'medium', language = 'en' } = req.body;

    const validTypes = ['email', 'proposal', 'social-post', 'sales-script', 'case-study', 'blog-post', 'ad-copy'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Template-based generation (production would use OpenAI)
    const templates = {
      email: `Subject: [Your Subject Here]\n\nDear [Name],\n\nI hope this email finds you well. ${prompt}\n\nBest regards,\n[Your Name]`,
      proposal: `# Business Proposal\n\n## Executive Summary\n${prompt}\n\n## Scope of Work\n[Details here]\n\n## Investment\n[Pricing here]`,
      'social-post': `🚀 ${prompt}\n\n#business #growth #innovation`,
      'sales-script': `Opening: "Hi [Name], I'm calling about ${prompt}..."\n\nValue Prop: [Your pitch]\n\nClose: "Would you be open to a 15-minute call?"`,
      'case-study': `# Customer Success Story\n\n## Challenge\n${prompt}\n\n## Solution\n[What you did]\n\n## Results\n[Measurable outcomes]`,
      'blog-post': `# ${prompt}\n\n## Introduction\n[Hook your reader]\n\n## Main Points\n1. [Point 1]\n2. [Point 2]\n3. [Point 3]\n\n## Conclusion\n[Call to action]`,
      'ad-copy': `Headline: ${prompt}\n\nBody: [Compelling description]\n\nCTA: Get Started Today →`,
    };

    const content = templates[type] || `Generated content for: ${prompt}`;

    // Log generation
    await db.query(
      `INSERT INTO ai_generations (user_id, type, prompt, content, tone, language) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, type, prompt, content, tone, language]
    );

    res.json({ content, type, tone, language });
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- CONVERSATION HISTORY ----
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT conversation_id, 
         MIN(created_at) as started_at,
         MAX(created_at) as last_message_at,
         COUNT(*) as message_count,
         SUM(tokens_used) as total_tokens
       FROM ai_usage 
       WHERE user_id = $1
       GROUP BY conversation_id
       ORDER BY last_message_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ conversations: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('AI conversations error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/conversations/:conversationId', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM ai_usage 
       WHERE user_id = $1 AND conversation_id = $2
       ORDER BY created_at ASC`,
      [req.user.id, req.params.conversationId]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error('AI conversation detail error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- USAGE STATS ----
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const [monthly, daily, byModel] = await Promise.all([
      db.query(
        `SELECT SUM(tokens_used) as tokens, COUNT(*) as requests
         FROM ai_usage 
         WHERE user_id = $1 AND created_at > DATE_TRUNC('month', NOW())`,
        [req.user.id]
      ),
      db.query(
        `SELECT SUM(tokens_used) as tokens, COUNT(*) as requests
         FROM ai_usage 
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [req.user.id]
      ),
      db.query(
        `SELECT model, SUM(tokens_used) as tokens, COUNT(*) as requests
         FROM ai_usage 
         WHERE user_id = $1
         GROUP BY model ORDER BY tokens DESC`,
        [req.user.id]
      ),
    ]);

    res.json({
      monthly: monthly.rows[0],
      daily: daily.rows[0],
      by_model: byModel.rows,
      limits: { monthly_tokens: 100000 },
    });
  } catch (err) {
    console.error('AI usage error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- SAVED TEMPLATES ----
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ai_templates WHERE user_id = $1 OR is_public = true ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('AI templates error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/templates', requireAuth, async (req, res) => {
  try {
    const { name, type, prompt, is_public = false } = req.body;
    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required.' });
    }

    const result = await db.query(
      `INSERT INTO ai_templates (user_id, name, type, prompt, is_public) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, type || 'general', prompt, is_public]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (err) {
    console.error('AI template create error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
