'use strict';

const Redis = require('ioredis');

const STREAM_KEY_TTL = 60; // seconds – heartbeat expiry

let client = null;

function getClient() {
  if (client) return client;

  client = new Redis({
    host:             process.env.REDIS_HOST || 'redis',
    port:             parseInt(process.env.REDIS_PORT || '6379', 10),
    lazyConnect:      true,
    enableOfflineQueue: false,
    retryStrategy:    (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  });

  client.on('error', (err) => {
    // Log but don't crash – in-memory fallback is used when Redis is down
    console.warn('[Redis] connection error:', err.message);
  });

  return client;
}

async function setActive(streamKey, meta = {}) {
  try {
    await getClient().setex(
      `stream:${streamKey}:active`,
      STREAM_KEY_TTL,
      JSON.stringify({ ...meta, updatedAt: Date.now() })
    );
  } catch {
    // silently ignore – in-memory state handles this
  }
}

async function setInactive(streamKey) {
  try {
    await getClient().del(`stream:${streamKey}:active`);
  } catch {
    // ignore
  }
}

async function getActiveKeys() {
  try {
    const keys = await getClient().keys('stream:*:active');
    return keys.map((k) => k.replace('stream:', '').replace(':active', ''));
  } catch {
    return [];
  }
}

async function disconnect() {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}

module.exports = { setActive, setInactive, getActiveKeys, disconnect };
