'use strict';

/**
 * Simple API-key middleware for admin endpoints.
 * Clients must send:  X-Admin-Key: <ADMIN_API_KEY>
 */
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized – invalid or missing X-Admin-Key' });
  }
  next();
}

module.exports = adminAuth;
