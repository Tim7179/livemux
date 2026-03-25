'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = '/api';
const REFRESH_INTERVAL_MS = 10_000;

// ── State ───────────────────────────────────────────────────────────────────
let adminKey = localStorage.getItem('adminKey') || '';
const hlsInstances = new Map();   // streamKey → Hls instance

// ── Bootstrap helpers ───────────────────────────────────────────────────────
const toastEl      = document.getElementById('toast');
const bsToast      = new bootstrap.Toast(toastEl, { delay: 3000 });
const createKeyModal = new bootstrap.Modal(document.getElementById('createKeyModal'));

function showToast(msg, type = 'success') {
  const body = document.getElementById('toast-body');
  body.textContent = msg;
  toastEl.className = `toast align-items-center text-bg-${type === 'error' ? 'danger' : 'success'} border-0`;
  bsToast.show();
}

// ── API fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Page navigation ──────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('d-none'));
  document.getElementById(`page-${name}`).classList.remove('d-none');
  document.querySelectorAll('#sidebar .nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });

  switch (name) {
    case 'dashboard':    loadDashboard();    break;
    case 'multiview':    loadMultiview();    break;
    case 'stream-keys':  loadStreamKeys();   break;
    case 'recordings':   loadRecordings();   break;
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [streams, keys, recs, health] = await Promise.all([
      apiFetch('/streams'),
      apiFetch('/stream-keys'),
      apiFetch('/recordings'),
      apiFetch('/health').catch(() => null),
    ]);

    document.getElementById('stat-active').textContent      = streams.length;
    document.getElementById('stat-keys').textContent        = keys.length;
    document.getElementById('stat-recordings').textContent  = recs.length;
    document.getElementById('stat-status').innerHTML        = health
      ? '<span class="text-success">Online</span>'
      : '<span class="text-danger">Offline</span>';

    const container = document.getElementById('active-streams-list');
    if (streams.length === 0) {
      container.innerHTML = '<div class="col-12 text-muted">No active streams.</div>';
      return;
    }

    container.innerHTML = streams.map(s => `
      <div class="col-md-4">
        <div class="stream-card">
          <video class="stream-preview" id="prev-${s.streamKey}" muted autoplay playsinline></video>
          <div class="stream-meta d-flex align-items-center gap-2">
            <span class="live-badge">LIVE</span>
            <span class="fw-semibold">${escHtml(s.streamKey)}</span>
            <a href="/hls/${escHtml(s.streamKey)}.m3u8" target="_blank"
               class="ms-auto text-muted small" title="HLS URL">
              <i class="bi bi-box-arrow-up-right"></i>
            </a>
          </div>
        </div>
      </div>
    `).join('');

    streams.forEach(s => attachHls(`prev-${s.streamKey}`, s.streamKey));
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

// ── Multi-View ────────────────────────────────────────────────────────────────
async function loadMultiview() {
  destroyAllHls();
  const cols = parseInt(document.getElementById('gridLayout').value, 10);
  const total = cols * cols;
  const grid  = document.getElementById('multiview-grid');
  grid.className = `multiview-grid grid-${cols}`;

  let streams = [];
  try {
    streams = await apiFetch('/streams');
  } catch {
    // Show empty grid if auth fails or no streams
  }

  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const s   = streams[i];
    const div = document.createElement('div');
    div.className = 'multiview-cell';

    if (s) {
      div.innerHTML = `
        <video id="mv-${s.streamKey}" muted autoplay playsinline></video>
        <div class="cell-label">${escHtml(s.streamKey)}</div>
      `;
    } else {
      div.innerHTML = '<div class="cell-empty">No stream</div>';
    }
    grid.appendChild(div);
    if (s) attachHls(`mv-${s.streamKey}`, s.streamKey);
  }
}

// ── Stream Keys ───────────────────────────────────────────────────────────────
async function loadStreamKeys() {
  const tbody = document.getElementById('keys-table-body');
  try {
    const keys = await apiFetch('/stream-keys');
    tbody.innerHTML = keys.map(k => `
      <tr>
        <td class="fw-semibold">${escHtml(k.name)}</td>
        <td>
          <span class="key-badge" title="Click to copy" onclick="copyText('${escHtml(k.key)}')">
            ${escHtml(k.key.substring(0, 12))}…
          </span>
        </td>
        <td class="text-muted small">${escHtml(k.description || '–')}</td>
        <td>
          ${k.is_active
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>'}
        </td>
        <td class="text-muted small">${new Date(k.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1"
            onclick="toggleKey('${escHtml(k.key)}', ${k.is_active ? 0 : 1})">
            ${k.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-sm btn-outline-danger"
            onclick="deleteKey('${escHtml(k.key)}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">No stream keys yet.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${escHtml(err.message)}</td></tr>`;
  }
}

async function toggleKey(key, isActive) {
  try {
    await apiFetch(`/stream-keys/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
    showToast('Stream key updated');
    loadStreamKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteKey(key) {
  if (!confirm('Delete this stream key?')) return;
  try {
    await apiFetch(`/stream-keys/${key}`, { method: 'DELETE' });
    showToast('Stream key deleted');
    loadStreamKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Recordings ────────────────────────────────────────────────────────────────
async function loadRecordings() {
  const tbody = document.getElementById('recordings-table-body');
  try {
    const recs = await apiFetch('/recordings');
    tbody.innerHTML = recs.map(r => `
      <tr>
        <td class="font-monospace small">${escHtml(r.filename)}</td>
        <td>${escHtml(r.stream_key)}</td>
        <td>${formatBytes(r.size_bytes)}</td>
        <td class="text-muted small">${new Date(r.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger"
            onclick="deleteRecording('${escHtml(r.filename)}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="text-muted">No recordings yet.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${escHtml(err.message)}</td></tr>`;
  }
}

async function deleteRecording(filename) {
  if (!confirm(`Delete recording "${filename}"?`)) return;
  try {
    await apiFetch(`/recordings/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    showToast('Recording deleted');
    loadRecordings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── HLS.js helpers ────────────────────────────────────────────────────────────
function attachHls(videoId, streamKey) {
  const video = document.getElementById(videoId);
  if (!video) return;

  const url = `/hls/${streamKey}.m3u8`;

  if (Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 });
    hls.loadSource(url);
    hls.attachMedia(video);
    hlsInstances.set(streamKey, hls);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;  // Safari native HLS
  }
}

function destroyAllHls() {
  hlsInstances.forEach(hls => hls.destroy());
  hlsInstances.clear();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
}

function formatBytes(b) {
  if (!b) return '–';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.querySelectorAll('#sidebar .nav-link').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showPage(a.dataset.page); });
});

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  adminKey = document.getElementById('adminKeyInput').value.trim();
  localStorage.setItem('adminKey', adminKey);
  showToast('Admin key saved');
  showPage('dashboard');
});

document.getElementById('createKeyBtn').addEventListener('click', async () => {
  const name = document.getElementById('newKeyName').value.trim();
  const desc = document.getElementById('newKeyDesc').value.trim();
  try {
    await apiFetch('/stream-keys', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
    createKeyModal.hide();
    showToast('Stream key created');
    loadStreamKeys();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('refreshMultiview').addEventListener('click', loadMultiview);
document.getElementById('gridLayout').addEventListener('change', loadMultiview);

// ── Init ──────────────────────────────────────────────────────────────────────
if (adminKey) document.getElementById('adminKeyInput').value = adminKey;
showPage('dashboard');
setInterval(() => {
  const active = document.querySelector('#sidebar .nav-link.active');
  if (active) showPage(active.dataset.page);
}, REFRESH_INTERVAL_MS);
