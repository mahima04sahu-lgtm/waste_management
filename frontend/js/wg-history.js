/* WasteGuard — Segregation History Controller (wg-history.js)
   Renders readable event history with structured sensor readings and details modal. */

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthManager) AuthManager.renderUserNav();
  HistoryManager.init();
});

const HistoryManager = {
  _page: 1,
  _pageSize: 20,
  _hasNext: false,
  _hasPrev: false,
  _currentLogs: [],

  async init() {
    this._setupControls();
    await this._load();
  },

  _setupControls() {
    const searchInput = document.getElementById('filter-action-search');
    const catSelect = document.getElementById('filter-category-select');
    const refreshBtn = document.getElementById('btn-reload-history');
    const closeBtn = document.getElementById('btn-close-modal');
    const dismissBtn = document.getElementById('btn-dismiss-modal');
    const backdrop = document.getElementById('event-modal-backdrop');

    let timer;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { this._page = 1; this._load(); }, 300);
      });
    }

    if (catSelect) {
      catSelect.addEventListener('change', () => {
        this._page = 1;
        this._load();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._load());
    }

    if (closeBtn) closeBtn.addEventListener('click', () => this._closeModal());
    if (dismissBtn) dismissBtn.addEventListener('click', () => this._closeModal());
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this._closeModal();
      });
    }
  },

  async _load() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Loading segregation history...</td></tr>';

    const search = (document.getElementById('filter-action-search')?.value || '').trim();
    const catFilter = (document.getElementById('filter-category-select')?.value || '').trim();

    // Prefer SEGREGATION_EVENT actions; if search provided, apply action filter
    let url = `/audit-logs/?page=${this._page}&page_size=${this._pageSize}`;
    if (!search) {
      url += `&action=SEGREGATION_EVENT`;
    } else {
      url += `&action=${encodeURIComponent(search)}`;
    }

    try {
      let resp = await ApiClient.get(url);
      let logs = resp.results || resp || [];

      // If no SEGREGATION_EVENT logs exist yet in a fresh database, fallback to all audit logs
      if (logs.length === 0 && !search) {
        resp = await ApiClient.get(`/audit-logs/?page=${this._page}&page_size=${this._pageSize}`);
        logs = resp.results || resp || [];
      }

      this._hasNext = !!resp.next;
      this._hasPrev = !!resp.previous;
      this._updatePagination();

      // Client-side category filter if selected
      if (catFilter) {
        logs = logs.filter(log => {
          const meta = log.metadata || {};
          const pCat = (meta.predicted_category || '').toLowerCase();
          return pCat === catFilter.toLowerCase();
        });
      }

      this._currentLogs = logs;

      if (logs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="table-loading" style="padding:28px 16px; color:#64748b;">
              <div style="font-size:24px; margin-bottom:6px;">📋</div>
              <strong>No segregation records found.</strong><br>
              <span style="font-size:12px;">Events sent from the Arduino Uno prototype will be logged chronologically here.</span>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = logs.map(log => {
        const meta = log.metadata || {};
        const ts = this._formatDate(log.timestamp);
        const eventId = `#EVT-${log.id}`;
        const station = log.entity_id || 'STATION-01';

        // Metal reading
        const metalStr = meta.metal_detected
          ? '<span class="cat-badge cat-metal">🔩 Detected</span>'
          : '<span style="color:#64748b; font-size:12px;">Clear</span>';

        // Moisture reading
        const moistVal = typeof meta.moisture_value === 'number'
          ? `${Number(meta.moisture_value).toFixed(1)}%`
          : (typeof meta.moisture === 'number' ? `${Number(meta.moisture).toFixed(1)}%` : (meta.moisture_detected ? 'Wet' : 'Dry'));

        const isWet = meta.moisture_detected || (typeof meta.moisture_value === 'number' && meta.moisture_value >= 45.0);
        const moistStr = isWet
          ? `<span class="cat-badge cat-wet">🍃 ${moistVal}</span>`
          : `<span style="font-size:12px; color:#475569;">${moistVal}</span>`;

        // Output Category
        const catBadge = this._catBadge(meta.predicted_category || 'Dry');
        const statusBadge = `<span class="status-badge status-online">${this._esc(meta.status || 'Completed')}</span>`;

        return `
          <tr>
            <td style="white-space:nowrap; font-size:12px; color:#64748b;">${ts}</td>
            <td><code style="font-size:11.5px; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">${eventId}</code></td>
            <td style="font-size:12.5px; font-weight:600; color:#0f172a;">${this._esc(station)}</td>
            <td>${metalStr}</td>
            <td>${moistStr}</td>
            <td>${catBadge}</td>
            <td>${statusBadge}</td>
            <td style="text-align:right;">
              <button class="btn-secondary-sm" onclick="HistoryManager.showDetails(${log.id})" style="padding:3px 9px; font-size:11.5px; border-radius:5px; cursor:pointer;">
                View Details
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('[History] Fetch error:', err);
      tbody.innerHTML = `<tr><td colspan="8" class="table-loading" style="color:#ef4444;">
        ⚠ Failed to load history: ${this._esc(err.message || 'Check connection')}
      </td></tr>`;
    }
  },

  showDetails(logId) {
    const log = this._currentLogs.find(l => l.id === logId);
    if (!log) return;

    const meta = log.metadata || {};
    const modal = document.getElementById('event-modal-backdrop');
    const title = document.getElementById('modal-event-title');
    const body = document.getElementById('modal-event-body');

    if (title) title.textContent = `Event Details — #EVT-${log.id}`;

    const metalText = meta.metal_detected ? 'Triggered (Inductive Ferrous Metal)' : 'Clear (No Metal Detected)';
    const moistVal = typeof meta.moisture_value === 'number' ? `${meta.moisture_value.toFixed(1)}%` : '0.0%';
    const ruleText = meta.rule_applied || (meta.metal_detected ? 'Metal detected → Metal' : (meta.moisture_detected ? 'Moisture detected → Wet' : 'Neither detected → Dry (Residual)'));
    const category = meta.predicted_category || 'Dry';

    if (body) {
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="color:#64748b;">Timestamp</span>
            <strong>${this._formatDate(log.timestamp)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="color:#64748b;">Target Prototype Station</span>
            <strong>${this._esc(log.entity_id || 'STATION-01')}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="color:#64748b;">Metal Sensor Reading</span>
            <strong style="color:${meta.metal_detected ? '#0f172a' : '#64748b'};">${metalText}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="color:#64748b;">Moisture Sensor Reading</span>
            <strong>${moistVal} (Threshold: ≥ 45.0%)</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="color:#64748b;">Output Category</span>
            <div>${this._catBadge(category)}</div>
          </div>
          <div style="border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <div style="color:#64748b; margin-bottom:4px;">Rule Classification Decision</div>
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid #10b981; border-radius:0 6px 6px 0; font-family:monospace; font-size:12px; color:#0f172a;">
              ${this._esc(ruleText)}
            </div>
          </div>
          <div>
            <div style="color:#64748b; margin-bottom:4px;">Raw Event Payload</div>
            <pre style="background:#0f172a; color:#f8fafc; padding:10px; border-radius:6px; font-size:11px; overflow-x:auto;">${this._esc(JSON.stringify(meta, null, 2))}</pre>
          </div>
        </div>
      `;
    }

    if (modal) modal.style.display = 'flex';
  },

  _closeModal() {
    const modal = document.getElementById('event-modal-backdrop');
    if (modal) modal.style.display = 'none';
  },

  _catBadge(category) {
    const cat = (category || 'Dry').trim().toLowerCase();
    if (cat.includes('metal')) {
      return '<span class="cat-badge cat-metal">🔩 Metal</span>';
    } else if (cat.includes('wet')) {
      return '<span class="cat-badge cat-wet">🍃 Wet</span>';
    } else {
      return '<span class="cat-badge cat-dry">📦 Dry (Residual)</span>';
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

  _formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
             ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  },

  _esc(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};
