/* WasteGuard — Activity History Controller (wg-history.js)
   Reads from /api/audit-logs/ — requires authenticated session. */

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthManager) AuthManager.renderUserNav();
  HistoryManager.init();
});

const HistoryManager = {
  _page: 1,
  _pageSize: 20,
  _hasNext: false,
  _hasPrev: false,

  async init() {
    this._setupSearch();
    await this._load();
  },

  _setupSearch() {
    const input = document.getElementById('filter-action-search');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this._page = 1;
        this._load();
      }, 350);
    });
  },

  async _load() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading...</td></tr>';

    const search = (document.getElementById('filter-action-search')?.value || '').trim();
    let url = `/audit-logs/?page=${this._page}&page_size=${this._pageSize}`;
    if (search) url += `&action=${encodeURIComponent(search)}`;

    try {
      const resp = await ApiClient.get(url);
      const logs = resp.results || resp || [];
      this._hasNext = !!resp.next;
      this._hasPrev = !!resp.previous;

      this._updatePagination();

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No activity records found.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(log => {
        const ts = this._formatTs(log.timestamp);
        const actionLabel = this._formatAction(log.action);
        const metaPreview = this._metaPreview(log.metadata);
        const user = log.user_display || log.username || '—';

        return `
          <tr>
            <td style="white-space:nowrap; font-size:12px; color:#64748b;">${ts}</td>
            <td>
              <span class="action-label">${this._esc(actionLabel)}</span>
            </td>
            <td style="font-size:12.5px;">${this._esc(log.entity || '—')}</td>
            <td>
              <code style="font-size:11px; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">
                ${this._esc(log.entity_id || '—')}
              </code>
            </td>
            <td style="font-size:12.5px;">${this._esc(user)}</td>
            <td style="font-size:11.5px; color:#64748b; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${this._esc(JSON.stringify(log.metadata || {}))}">
              ${this._esc(metaPreview)}
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:#ef4444;">
        ⚠ Failed to load: ${this._esc(err.message || 'Check authentication')}
      </td></tr>`;
    }
  },

  _updatePagination() {
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const label   = document.getElementById('page-label');

    if (prevBtn) prevBtn.disabled = !this._hasPrev;
    if (nextBtn) nextBtn.disabled = !this._hasNext;
    if (label) label.textContent = `Page ${this._page}`;
  },

  prevPage() {
    if (this._hasPrev) { this._page--; this._load(); }
  },

  nextPage() {
    if (this._hasNext) { this._page++; this._load(); }
  },

  _formatAction(action) {
    if (!action) return '—';
    // Convert ACTION_CONFIRMED_HANDLE_NOW → Action Confirmed: Handle Now
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  },

  _metaPreview(meta) {
    if (!meta || typeof meta !== 'object') return '—';
    const keys = ['container_id', 'corrected_category', 'decision', 'reviewer', 'completed_by'];
    const parts = keys
      .filter(k => meta[k])
      .map(k => `${k}: ${meta[k]}`);
    return parts.length ? parts.join(' · ') : JSON.stringify(meta).slice(0, 80);
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
