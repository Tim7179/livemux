'use strict';

const express   = require('express');
const adminAuth = require('../middleware/adminAuth');
const { reviewCode } = require('../services/claudeReviewService');

const router = express.Router();
router.use(adminAuth);

/**
 * POST /api/admin/review
 * Body (JSON): { content: string, filename?: string, context?: string }
 * Returns: { review: string, model: string, usage: object }
 */
router.post('/review', async (req, res, next) => {
  const { content, filename, context } = req.body || {};

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: '`content` is required and must be a non-empty string' });
  }

  if (content.length > 100_000) {
    return res.status(400).json({ error: '`content` must not exceed 100,000 characters' });
  }

  try {
    const result = await reviewCode({
      content: content.trim(),
      filename: typeof filename === 'string' ? filename.trim() : 'code',
      context: typeof context === 'string' ? context.trim() : '',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
