/* WasteGuard Station Action Queue Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('actions.html')) return;
  ActionsManager.init();
});

class ActionsManager {
  static async init() {
    await this.loadActions();
    this.setupListeners();
  }

  static async loadActions() {
    const containerEl = document.getElementById('actions-page-list');
    if (!containerEl) return;

    try {
      const status = document.getElementById('filter-action-status')?.value || '';
      const priority = document.getElementById('filter-action-priority')?.value || '';

      let url = '/actions/?';
      if (status) url += `status=${encodeURIComponent(status)}&`;
      if (priority) url += `priority=${encodeURIComponent(priority)}&`;

      const response = await ApiClient.get(url);
      const actions = response.results || response;

      if (!actions || actions.length === 0) {
        containerEl.innerHTML = `<div class="card" style="padding:24px; text-align:center; color:var(--text-muted);">No manual review items matching filter. All stations operating nominally.</div>`;
        return;
      }

      containerEl.innerHTML = actions.map(act => `
        <div class="action-card priority-${act.priority}" style="margin-bottom:12px;">
          <div class="action-card-header">
            <div>
              <span class="action-bin-id">${act.container_id}</span>
              <span class="action-ward"> • ${act.location || 'Campus Location'}</span>
            </div>
            ${Components.getRiskBadge(act.priority)}
          </div>
          <div class="action-recommendation">
            <span>RECOMMENDED ACTION:</span>
            <span style="color:var(--accent-teal);">${act.action_type}</span>
          </div>
          <div class="action-reason">
            <strong>Rationale:</strong> ${act.reason}
          </div>
          <div class="flex-between" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-light);">
            <div style="font-size:12px; color:var(--text-secondary);">
              Status: <strong style="color:var(--text-primary);">${act.status}</strong> 
              ${act.assigned_username ? ` • Assigned: <strong>${act.assigned_username}</strong>` : ''}
            </div>
            <div style="display:flex; gap:8px;">
              <a href="/bin-details.html?id=${act.container_id}" class="btn btn-secondary btn-sm">Inspect Station</a>
              ${act.status === 'PENDING' ? `
                <button class="btn btn-primary btn-sm" onclick="ActionsManager.confirmActionItem(${act.id}, '${act.container_id}', '${act.action_type}')">
                  Acknowledge & Confirm
                </button>
              ` : ''}
              ${act.status === 'IN_PROGRESS' ? `
                <button class="btn btn-warning btn-sm" onclick="ActionsManager.completeActionItem(${act.id}, '${act.container_id}', '${act.action_type}')">
                  Mark Completed
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      containerEl.innerHTML = `<div class="text-danger">Failed to load action queue.</div>`;
    }
  }

  static confirmActionItem(id, containerId, type) {
    Components.confirmActionDialog({
      title: `Confirm Action: ${type}`,
      message: `Confirm initialization of <strong>${type}</strong> for container <strong>${containerId}</strong>?`,
      onConfirm: async () => {
        await ApiClient.post(`/actions/${id}/confirm/`, {});
        Components.showToast(`Action ${type} marked IN_PROGRESS`, 'success');
        this.loadActions();
      }
    });
  }

  static completeActionItem(id, containerId, type) {
    Components.confirmActionDialog({
      title: `Complete Action: ${type}`,
      message: `Mark operational protocol <strong>${type}</strong> as COMPLETED for <strong>${containerId}</strong>?`,
      onConfirm: async () => {
        await ApiClient.post(`/actions/${id}/complete/`, {});
        Components.showToast(`Action ${type} marked COMPLETED`, 'success');
        this.loadActions();
      }
    });
  }

  static setupListeners() {
    ['filter-action-status', 'filter-action-priority'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadActions());
    });
  }
}
