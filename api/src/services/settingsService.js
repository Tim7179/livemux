'use strict';

const { getDb } = require('../db/database');

const DEFAULT_NETWORKS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1/32'];
const SETTINGS_KEY = 'allowed_networks';

// ── CIDR helpers ──────────────────────────────────────────────────────────────

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => ((acc << 8) + parseInt(o, 10)) >>> 0, 0);
}

function isIPv4InCidr(ip, cidr) {
  const [network, prefix] = cidr.includes('/') ? cidr.split('/') : [cidr, '32'];
  const bits = parseInt(prefix, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

/** Strip IPv4-mapped IPv6 prefix (::ffff:x.x.x.x → x.x.x.x) */
function normalizeIP(ip) {
  if (typeof ip !== 'string') return '';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

/** Check whether an IP is in any of the given CIDR strings. */
function isAllowed(rawIp, networks) {
  if (!rawIp) return false;
  const ip = normalizeIP(rawIp);
  if (ip === '::1') return networks.some(n => isIPv4InCidr('127.0.0.1', n));
  const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Re.test(ip)) return false;
  return networks.some(cidr => isIPv4InCidr(ip, cidr));
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateCidr(cidr) {
  const re = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!re.test(cidr)) {
    throw Object.assign(new Error(`Invalid CIDR: "${cidr}"`), { status: 400 });
  }
  const [addr, prefix] = cidr.split('/');
  const octets = addr.split('.').map(Number);
  if (octets.some(o => o > 255)) {
    throw Object.assign(new Error(`Invalid IP address: "${cidr}"`), { status: 400 });
  }
  if (prefix !== undefined) {
    const bits = parseInt(prefix, 10);
    if (bits < 0 || bits > 32) {
      throw Object.assign(new Error(`Invalid prefix length: "${cidr}"`), { status: 400 });
    }
  }
}

// ── DB access ─────────────────────────────────────────────────────────────────

function getNetworks() {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTINGS_KEY);
  if (!row) return [...DEFAULT_NETWORKS];
  try { return JSON.parse(row.value); } catch { return [...DEFAULT_NETWORKS]; }
}

function setNetworks(networks) {
  if (!Array.isArray(networks) || networks.length === 0) {
    throw Object.assign(new Error('`networks` must be a non-empty array'), { status: 400 });
  }
  if (networks.length > 100) {
    throw Object.assign(new Error('Maximum 100 network rules allowed'), { status: 400 });
  }
  networks.forEach(validateCidr);

  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(SETTINGS_KEY, JSON.stringify(networks));

  return getNetworks();
}

module.exports = { getNetworks, setNetworks, isAllowed, DEFAULT_NETWORKS };
