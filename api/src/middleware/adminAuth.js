'use strict';

const crypto = require('crypto');

/**
 * Admin API-key middleware.
 * Clients must send:  X-Admin-Key: <ADMIN_API_KEY>
 *
 * Uses crypto.timingSafeEqual to prevent timing-based key enumeration attacks.
 */
function adminAuth(req, res, next) {
  const provided = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_API_KEY;

  if (!provided || !expected) {
    return res.status(401).json({ error: 'Unauthorized – missing X-Admin-Key' });
  }

  // Timing-safe comparison: both buffers must be the same byte-length first
  let valid = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized – invalid X-Admin-Key' });
  }

  next();
}

module.exports = adminAuth;
