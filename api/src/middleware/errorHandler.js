'use strict';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('[ERROR]', err);
    if (process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
    }
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
