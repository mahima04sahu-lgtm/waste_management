/* WasteGuard — Manual Reviews Page Controller (wg-reviews.js) */

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthManager) AuthManager.renderUserNav();
  ReviewsManager.init();
});

const ReviewsManager = {
  _currentActionId: null,
  _currentContainerId: null,

  async init() {
    this._setupFilters();
    await this._load();
  },

  _setupFilters() {
    ['filter-status', 'filter-priority'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this._load());
    });
  },

  async _load() {
    const listEl = document.getElementById('review-queue-list');
    const countLabel = document.getElementById('queue-count-label');
    if (!listEl) return;

    const status = document.getElementById('filter-status')?.value || '';
    const priority = document.getElementById('filter-priority')?.value || '';

    let url = '/actions/?';
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (priority) url += `priority=${encodeURIComponent(priority)}&`;

    try {
      const resp = await ApiClient.get(url);
      const items = resp.results || resp || [];

      if (countLabel) {
        countLabel.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} in queue`;
      }

      if (items.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">✅</span>
            <span>No review items match current filters</span>
          </div>`;
        return;
      }

      listEl.innerHTML = items.map(item => this._renderItem(item)).join('');

    } catch (err) {
      listEl.innerHTML = `
        <div class="empty-state" style="color:#ef4444;">
          <span class="empty-icon">⚠️</span>
          <span>Failed to load review queue: ${this._esc(err.message || 'Server error')}</span>
        </div>`;
    }
  },

  _renderItem(item) {
    const cat = (item.review_category || item.waste_category || '').toUpperCase();
    const catHtml = cat ? this._catBadge(cat) : '<span style="color:#94a3b8; font-size:12px;">—</span>';
    const ts = this._formatTs(item.created_at);
    const priClass = (item.priority || 'low').toLowerCase();
    const isPending = item.status === 'PENDING';
    const isInProgress = item.status === 'IN_PROGRESS';

    return `
      <div class="review-item" id="review-item-${item.id}">
        <div class="review-main">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:4px;">
            <span class="review-station-id">${this._esc(item.container_id || '—')}</span>
            <span class="priority-badge priority-${priClass}">${item.priority || 'LOW'}</span>
            ${catHtml}
          </div>
          <div class="review-location">
            📍 ${this._esc(item.location || item.ward || 'Campus')}
            ${item.container_name ? `· ${this._esc(item.container_name)}` : ''}
          </div>
          <div class="review-reason">
            <strong>Reason:</strong> ${this._esc(item.reason || 'No reason specified')}
          </div>
          <div class="review-meta">
            <span style="font-size:12px; color:#64748b;">Action: <strong>${this._esc(item.action_type)}</strong></span>
            <span style="font-size:12px; color:#94a3b8;">·</span>
            <span style="font-size:12px; color:#64748b;">Status: <strong>${item.status}</strong></span>
            ${item.assigned_username ? `<span style="font-size:12px; color:#64748b;">· Assigned: <strong>${this._esc(item.assigned_username)}</strong></span>` : ''}
            <span style="font-size:12px; color:#94a3b8;">·</span>
            <span style="font-size:11.5px; color:#94a3b8;">${ts}</span>
          </div>
        </div>
        <div class="review-actions">
          ${isPending ? `
            <button class="btn-secondary-sm" onclick="ReviewsManager.openModal(${item.id}, '${this._esc(item.container_id)}', '${this._esc(item.action_type)}', '${this._esc(cat)}')">
              Confirm / Correct →
            </button>
          ` : ''}
          ${isInProgress ? `
            <button class="btn-primary-sm" onclick="ReviewsManager.openModal(${item.id}, '${this._esc(item.container_id)}', '${this._esc(item.action_type)}', '${this._esc(cat)}')">
              Record Decision →
            </button>
          ` : ''}
          ${!isPending && !isInProgress ? `
            <span style="font-size:12px; color:#15803d; font-weight:600;">✓ Resolved</span>
          ` : ''}
        </div>
      </div>
    `;
  },

  openModal(actionId, containerId, actionType, currentCategory) {
    this._currentActionId = actionId;
    this._currentContainerId = containerId;

    const modal = document.getElementById('review-modal');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    const origLabel = document.getElementById('cat-confirm-original');
    const origParent = document.getElementById('cat-original-label');

    if (title) title.textContent = `Review Decision: ${containerId}`;
    if (desc) desc.textContent =
      `Select the correct waste category for this station, or confirm the existing classification. The decision will be recorded in Activity History.`;

    if (origParent && currentCategory) {
      const catNames = { DRY: '📦 Dry Waste', WET: '🍃 Wet Waste', HAZARDOUS: '☣️ Hazardous' };
      const label = catNames[currentCategory] || currentCategory;
      origParent.querySelector('.cat-pill').textContent = `✓ Confirm current: ${label}`;
    }

    // Reset radio selection to "confirm current"
    if (origLabel) origLabel.checked = true;

    if (modal) modal.style.display = 'flex';
  },

  closeModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
    this._currentActionId = null;
    this._currentContainerId = null;
  },

  async submitReview() {
    if (!this._currentActionId) return;

    const selected = document.querySelector('input[name="cat-decision"]:checked');
    const correctedCategory = selected ? selected.value : '';

    const btn = document.getElementById('modal-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      await ApiClient.post(`/actions/${this._currentActionId}/confirm-review/`, {
        corrected_category: correctedCategory || undefined
      });

      const msg = correctedCategory
        ? `Review recorded. Category corrected to ${correctedCategory}.`
        : 'Review confirmed. Category unchanged.';

      if (window.Components) Components.showToast(msg, 'success');
      this.closeModal();
      await this._load();

    } catch (err) {
      if (window.Components) Components.showToast(`Failed: ${err.message || 'Server error'}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Record Decision'; }
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
