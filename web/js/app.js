'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = '/api';
const REFRESH_INTERVAL_MS = 10_000;

// ── State ───────────────────────────────────────────────────────────────────
let adminKey = sessionStorage.getItem('adminKey') || '';
const hlsInstances = new Map();   // streamKey → Hls instance

// ── Bootstrap helpers ───────────────────────────────────────────────────────
const toastEl        = document.getElementById('toast');
const bsToast        = new bootstrap.Toast(toastEl, { delay: 3000 });
const createKeyModal = new bootstrap.Modal(document.getElementById('createKeyModal'));
const createUserModal = new bootstrap.Modal(document.getElementById('createUserModal'));
const batchUserModal  = new bootstrap.Modal(document.getElementById('batchUserModal'));

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
// refreshPage: reload data only, without destroying active HLS streams.
// Used by the auto-refresh interval so streams are not interrupted.
function refreshPage(name) {
  switch (name) {
    case 'dashboard':    loadDashboard();    break;
    case 'multiview':    loadMultiview();    break;
    case 'stream-keys':  loadStreamKeys();   break;
    case 'recordings':   loadRecordings();   break;
    case 'users':        loadUsers();        break;
  }
}

function showPage(name) {
  destroyAllHls();
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
    case 'users':        loadUsers();        break;
    case 'network':      loadNetwork();      break;
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
          <span class="key-badge font-monospace" title="Click to copy"
                data-copy="${escHtml(k.key)}" style="cursor:pointer">
            ${escHtml(k.key)}
          </span>
        </td>
        <td class="text-muted small">${escHtml(k.description || '–')}</td>
        <td>
          ${k.is_active
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>'}
        </td>
        <td class="text-muted small">${new Date(k.created_at).toLocaleString()}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-warning me-1"
                  data-action="toggle" data-key="${escHtml(k.key)}" data-active="${k.is_active ? 0 : 1}">
            ${k.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-sm btn-outline-danger"
                  data-action="delete" data-key="${escHtml(k.key)}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">No stream keys yet.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${escHtml(err.message)}</td></tr>`;
  }
}

// Event delegation for stream key table actions
document.getElementById('keys-table-body').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  const copy = e.target.closest('[data-copy]');
  if (copy) { copyText(copy.dataset.copy); return; }
  if (!btn) return;
  const { action, key, active } = btn.dataset;
  if (action === 'toggle') {
    try {
      await apiFetch(`/stream-keys/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: parseInt(active) }),
      });
      showToast('Stream key updated');
      loadStreamKeys();
    } catch (err) { showToast(err.message, 'error'); }
  } else if (action === 'delete') {
    if (!confirm('Delete this stream key?')) return;
    try {
      await apiFetch(`/stream-keys/${key}`, { method: 'DELETE' });
      showToast('Stream key deleted');
      loadStreamKeys();
    } catch (err) { showToast(err.message, 'error'); }
  }
});

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
        <td>${recordingStatusBadge(r.status)}</td>
        <td class="text-muted small">${new Date(r.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" ${r.status === 'converting' ? 'disabled' : ''}
            onclick="deleteRecording('${escHtml(r.filename)}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">No recordings yet.</td></tr>';
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

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    const users = await apiFetch('/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td class="text-muted small">${u.id}</td>
        <td class="fw-semibold">${escHtml(u.username)}</td>
        <td class="text-muted small">${escHtml(u.email || '–')}</td>
        <td class="text-muted small">${escHtml(u.note || '–')}</td>
        <td class="text-muted small">${new Date(u.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">No users yet.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${escHtml(err.message)}</td></tr>`;
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try {
    await apiFetch(`/users/${id}`, { method: 'DELETE' });
    showToast('User deleted');
    loadUsers();
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

function recordingStatusBadge(status) {
  switch (status) {
    case 'converting': return '<span class="badge bg-warning text-dark"><i class="bi bi-arrow-repeat me-1"></i>Converting</span>';
    case 'failed':     return '<span class="badge bg-danger">Failed</span>';
    default:           return '<span class="badge bg-success">Ready</span>';
  }
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
  sessionStorage.setItem('adminKey', adminKey);
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

// ── Batch Generate Keys ───────────────────────────────────────────────────────
const generateKeysModal = new bootstrap.Modal(document.getElementById('generateKeysModal'));

function updateGenPreview() {
  const count  = parseInt(document.getElementById('genCount').value, 10) || 1;
  const prefix = document.getElementById('genPrefix').value.trim() || 'OBS';
  const pad    = Math.max(String(count).length, 2);
  document.getElementById('genPreview').textContent     = `${prefix}-${'1'.padStart(pad, '0')}`;
  document.getElementById('genPreviewLast').textContent = `${prefix}-${String(count).padStart(pad, '0')}`;
}
document.getElementById('genCount').addEventListener('input', updateGenPreview);
document.getElementById('genPrefix').addEventListener('input', updateGenPreview);

document.getElementById('generateKeysBtn').addEventListener('click', async () => {
  const count  = parseInt(document.getElementById('genCount').value, 10);
  const prefix = document.getElementById('genPrefix').value.trim() || 'OBS';
  const type   = document.getElementById('genType').value;
  const btn    = document.getElementById('generateKeysBtn');

  if (!count || count < 1 || count > 500) { showToast('Count must be 1–500', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generating…';
  try {
    const data = await apiFetch('/stream-keys/generate', {
      method: 'POST',
      body: JSON.stringify({ count, prefix, type }),
    });
    const rows    = data.created || [];
    const errCount = (data.errors || []).length;
    document.getElementById('genResultTitle').textContent =
      `Generated ${rows.length} key${rows.length !== 1 ? 's' : ''}${errCount ? ` (${errCount} failed)` : ''}`;

    const host = window.location.hostname;
    document.getElementById('genResultBody').innerHTML = rows.map(k => `
      <tr>
        <td class="fw-semibold">${escHtml(k.name)}</td>
        <td><code class="text-light" style="cursor:pointer" title="Click to copy"
                  data-copy="${escHtml(k.key)}">${escHtml(k.key)}</code></td>
        <td class="text-muted small font-monospace">rtmp://${escHtml(host)}:1935/live</td>
      </tr>`).join('');

    // copy clicks in result table
    document.getElementById('genResultBody').querySelectorAll('[data-copy]').forEach(el => {
      el.addEventListener('click', () => copyText(el.dataset.copy));
    });

    document.getElementById('genCopyAllBtn').onclick = () => {
      const csv = 'Name,Stream Key,RTMP Server\n' +
        rows.map(k => `${k.name},${k.key},rtmp://${host}:1935/live`).join('\n');
      copyText(csv);
      showToast('Copied CSV to clipboard');
    };

    document.getElementById('genResult').classList.remove('d-none');
    loadStreamKeys();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lightning me-1"></i>Generate';
  }
});

// reset result when modal reopens
document.getElementById('generateKeysModal').addEventListener('show.bs.modal', () => {
  document.getElementById('genResult').classList.add('d-none');
  updateGenPreview();
});

document.getElementById('refreshMultiview').addEventListener('click', loadMultiview);
document.getElementById('gridLayout').addEventListener('change', loadMultiview);

// ── Users event wiring ────────────────────────────────────────────────────────
document.getElementById('createUserBtn').addEventListener('click', async () => {
  const username = document.getElementById('newUsername').value.trim();
  const email    = document.getElementById('newUserEmail').value.trim();
  const note     = document.getElementById('newUserNote').value.trim();
  try {
    await apiFetch('/users', { method: 'POST', body: JSON.stringify({ username, email: email || undefined, note: note || undefined }) });
    createUserModal.hide();
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserNote').value = '';
    showToast('User created');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Batch import tab switching
document.querySelectorAll('[data-batch-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-batch-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.batchTab;
    document.getElementById('batch-json-panel').classList.toggle('d-none', tab !== 'json');
    document.getElementById('batch-csv-panel').classList.toggle('d-none', tab !== 'csv');
  });
});

document.getElementById('batchImportBtn').addEventListener('click', async () => {
  const resultEl = document.getElementById('batch-import-result');
  const activeTab = document.querySelector('[data-batch-tab].active')?.dataset.batchTab || 'json';
  resultEl.classList.add('d-none');

  try {
    let data;
    if (activeTab === 'csv') {
      const csv = document.getElementById('batchUsersCsv').value;
      if (!csv.trim()) { showToast('Please enter CSV data', 'error'); return; }
      const res = await fetch(`${API_BASE}/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv', 'X-Admin-Key': adminKey },
        body: csv,
      });
      if (res.status === 204) { data = null; } else { data = await res.json().catch(() => ({})); }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    } else {
      const json = document.getElementById('batchUsersJson').value;
      if (!json.trim()) { showToast('Please enter JSON data', 'error'); return; }
      let users;
      try { users = JSON.parse(json); } catch { showToast('Invalid JSON', 'error'); return; }
      if (!Array.isArray(users)) { showToast('JSON must be an array of user objects', 'error'); return; }
      data = await apiFetch('/users/batch', { method: 'POST', body: JSON.stringify({ users }) });
    }
    const created = data?.created?.length ?? 0;
    const errors  = data?.errors?.length ?? 0;
    resultEl.innerHTML = `
      <div class="alert alert-${errors === 0 ? 'success' : created === 0 ? 'danger' : 'warning'} py-2">
        <strong>${created}</strong> created, <strong>${errors}</strong> failed.
        ${errors > 0 ? `<br><small>${(data.errors || []).map(e => escHtml(`Row ${e.index + 1} (${e.username || '?'}): ${e.error}`)).join('<br>')}</small>` : ''}
      </div>`;
    resultEl.classList.remove('d-none');
    if (created > 0) loadUsers();
  } catch (err) {
    resultEl.innerHTML = `<div class="alert alert-danger py-2">${escHtml(err.message)}</div>`;
    resultEl.classList.remove('d-none');
  }
});

// ── Network ───────────────────────────────────────────────────────────────────
const DEFAULT_NETWORKS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.1/32'];
let networkDraft = [];

async function loadNetwork() {
  try {
    const data = await apiFetch('/settings/network');
    networkDraft = [...data.networks];
    renderNetworkList();
  } catch (err) {
    showToast('Failed to load network settings: ' + err.message, 'danger');
  }
}

function renderNetworkList() {
  const ul = document.getElementById('networkList');
  if (networkDraft.length === 0) {
    ul.innerHTML = '<li class="list-group-item bg-transparent text-muted small">No rules — all traffic will be blocked.</li>';
    return;
  }
  ul.innerHTML = networkDraft.map((cidr, i) => `
    <li class="list-group-item bg-transparent border-secondary d-flex justify-content-between align-items-center py-2">
      <code class="text-light">${escHtml(cidr)}</code>
      <button class="btn btn-outline-danger btn-sm py-0 px-2" data-net-idx="${i}">
        <i class="bi bi-trash"></i>
      </button>
    </li>`).join('');
  ul.querySelectorAll('[data-net-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      networkDraft.splice(parseInt(btn.dataset.netIdx), 1);
      renderNetworkList();
    });
  });
}

document.getElementById('addNetworkBtn').addEventListener('click', () => {
  const input = document.getElementById('networkInput');
  const val = input.value.trim();
  if (!val) return;
  if (networkDraft.includes(val)) { showToast('Already in the list', 'warning'); return; }
  networkDraft.push(val);
  renderNetworkList();
  input.value = '';
});

document.getElementById('networkInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addNetworkBtn').click();
});

document.getElementById('saveNetworkBtn').addEventListener('click', async () => {
  try {
    await apiFetch('/settings/network', {
      method: 'PUT',
      body: JSON.stringify({ networks: networkDraft }),
    });
    showToast('Network rules saved');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'danger');
  }
});

document.getElementById('resetNetworkBtn').addEventListener('click', () => {
  networkDraft = [...DEFAULT_NETWORKS];
  renderNetworkList();
  showToast('Reset to defaults (not yet saved)');
});

// ── Init ──────────────────────────────────────────────────────────────────────
if (adminKey) document.getElementById('adminKeyInput').value = adminKey;
showPage('dashboard');
setInterval(() => {
  const active = document.querySelector('#sidebar .nav-link.active');
  if (active) refreshPage(active.dataset.page);
}, REFRESH_INTERVAL_MS);
