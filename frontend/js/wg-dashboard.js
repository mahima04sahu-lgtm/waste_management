/* WasteGuard — Dashboard Controller (wg-dashboard.js)
   Fetches real data from backend APIs. No hardcoded demo values. */

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthManager) AuthManager.renderUserNav();
  DashboardController.init();
});

const DashboardController = {
  pollTimer: null,

  async init() {
    this._setupRefreshBtn();
    await this._load();
    // Auto-refresh every 8 seconds
    this.pollTimer = setInterval(() => this._load(true), 8000);
  },

  _setupRefreshBtn() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const icon = document.getElementById('refresh-icon');
      if (icon) icon.style.transform = 'rotate(360deg)';
      await this._load();
      setTimeout(() => { if (icon) icon.style.transform = ''; }, 500);
    });
  },

  async _load(background = false) {
    try {
      // Fetch stations and pending actions in parallel
      const [containersResp, actionsResp] = await Promise.all([
        ApiClient.get('/containers/').catch(e => { console.error('[Dashboard] containers:', e); return null; }),
        ApiClient.get('/actions/?status=PENDING').catch(e => { console.error('[Dashboard] actions:', e); return null; }),
      ]);

      const stations = containersResp ? (containersResp.results || containersResp) : [];
      const pendingReviews = actionsResp ? (actionsResp.results || actionsResp) : [];

      this._updateKPIs(stations, pendingReviews);
      this._renderEventsTable(stations);
      this._renderReviewsSummary(pendingReviews);
      this._updateNavBadge(pendingReviews.length);

      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const label = document.getElementById('last-updated-label');
      if (label) label.textContent = `Updated ${ts}`;

    } catch (err) {
      console.error('[Dashboard] Fatal error:', err);
      if (!background) {
        const body = document.getElementById('events-table-body');
        if (body) body.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:#ef4444;">⚠ Unable to load data — ${this._esc(err.message || 'Check backend')}</td></tr>`;
      }
    }
  },

  _updateKPIs(stations, pendingReviews) {
    const total = stations.length;
    const dry   = stations.filter(s => (s.waste_category || '').toUpperCase() === 'DRY').length;
    const wet   = stations.filter(s => (s.waste_category || '').toUpperCase() === 'WET').length;
    const haz   = stations.filter(s => (s.waste_category || '').toUpperCase() === 'HAZARDOUS').length;
    const pending = pendingReviews.length;

    this._setVal('kpi-total-val', total);
    this._setVal('kpi-reviews-val', pending);
    this._setVal('kpi-dry-val', dry);
    this._setVal('kpi-wet-val', wet);
    this._setVal('kpi-haz-val', haz);

    // Flash the reviews card if there are pending items
    const reviewCard = document.getElementById('kpi-reviews');
    if (reviewCard) {
      reviewCard.style.borderLeftColor = pending > 0 ? '#f59e0b' : '#e2e8f0';
    }
  },

  _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  _renderEventsTable(stations) {
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    if (!stations || stations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No station records found.</td></tr>';
      return;
    }

    tbody.innerHTML = stations.map(s => {
      const cat = (s.waste_category || '').toUpperCase();
      const catHtml = this._catBadge(cat);
      const statusHtml = s.device_status === 'ONLINE'
        ? '<span class="status-badge status-online">Online</span>'
        : '<span class="status-badge status-offline">Offline</span>';
      const reviewHtml = s.manual_review_pending
        ? '<span class="status-badge status-review">⚠ Review</span>'
        : '—';
      const ts = this._formatTs(s.updated_at);

      return `
        <tr>
          <td><strong>${this._esc(s.container_id)}</strong></td>
          <td>
            <div>${this._esc(s.name || s.container_id)}</div>
            <div style="font-size:11px; color:#94a3b8;">${this._esc(s.location || '')}</div>
          </td>
          <td>${catHtml}</td>
          <td>${statusHtml}</td>
          <td>${reviewHtml}</td>
          <td style="white-space:nowrap; font-size:12px; color:#64748b;">${ts}</td>
        </tr>
      `;
    }).join('');
  },

  _renderReviewsSummary(pendingReviews) {
    const container = document.getElementById('reviews-summary-list');
    if (!container) return;

    if (!pendingReviews || pendingReviews.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✅</span>
          <span>No pending reviews — all stations operating normally</span>
        </div>`;
      return;
    }

    container.innerHTML = pendingReviews.slice(0, 5).map(r => `
      <div class="review-strip-item">
        <span class="priority-badge priority-${(r.priority || 'low').toLowerCase()}">${r.priority || 'LOW'}</span>
        <span><strong>${this._esc(r.container_id || '—')}</strong> · ${this._esc(r.location || r.ward || 'Campus')}</span>
        <span style="flex:1; font-size:12px; color:#64748b;">${this._esc(r.reason || 'Review required')}</span>
        <a href="reviews.html" style="font-size:12px; font-weight:600; color:#16a34a; text-decoration:none;">Review →</a>
      </div>
    `).join('') + (pendingReviews.length > 5 ? `
      <div class="review-strip-item" style="justify-content:center;">
        <a href="reviews.html" style="font-size:13px; font-weight:600; color:#16a34a; text-decoration:none;">
          + ${pendingReviews.length - 5} more pending — view all →
        </a>
      </div>
    ` : '');
  },

  _updateNavBadge(count) {
    const badge = document.getElementById('nav-review-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  },

  _catBadge(cat) {
    const map = {
      DRY: ['📦 Dry', 'cat-dry'],
      WET: ['🍃 Wet', 'cat-wet'],
      HAZARDOUS: ['☣️ Hazardous', 'cat-haz'],
    };
    const [label, cls] = map[cat] || ['— Unknown', 'cat-other'];
    return `<span class="cat-badge ${cls}">${label}</span>`;
  },

  _formatTs(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return iso; }
  },

  _esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
