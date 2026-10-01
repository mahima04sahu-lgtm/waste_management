/* HazGuard Alerts Matrix Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('alerts.html')) return;
  AlertsManager.init();
});

class AlertsManager {
  static async init() {
    await this.loadAlerts();
    this.setupListeners();
  }

  static async loadAlerts() {
    const listEl = document.getElementById('alerts-page-list');
    if (!listEl) return;

    try {
      const severity = document.getElementById('filter-alert-severity')?.value || '';
      const status = document.getElementById('filter-alert-status')?.value || '';

      let url = '/alerts/?';
      if (severity) url += `severity=${encodeURIComponent(severity)}&`;
      if (status) url += `status=${encodeURIComponent(status)}&`;

      const response = await ApiClient.get(url);
      const alerts = response.results || response;

      if (!alerts || alerts.length === 0) {
        listEl.innerHTML = `<div class="card" style="padding:24px; text-align:center; color:var(--text-muted);">No active system alerts. All operational parameters normal.</div>`;
        return;
      }

      listEl.innerHTML = alerts.map(alt => {
        let borderClr = 'var(--accent-teal)';
        if (alt.severity === 'CRITICAL') borderClr = 'var(--status-critical)';
        else if (alt.severity === 'HIGH') borderClr = 'var(--status-high)';
        else if (alt.severity === 'WARNING') borderClr = 'var(--status-medium)';

        return `
          <div class="card" style="border-left:4px solid ${borderClr}; margin-bottom:12px; padding:16px;">
            <div class="flex-between" style="margin-bottom:6px;">
              <div style="font-weight:700; font-size:14px; color:var(--text-primary);">
                ${alt.container_id} • <span style="font-weight:600; color:var(--text-secondary);">${alt.ward}</span>
              </div>
              <div style="display:flex; gap:6px;">
                ${Components.getRiskBadge(alt.severity)}
                <span class="badge badge-low">${alt.status}</span>
              </div>
            </div>
            <div style="font-size:13px; color:var(--text-primary); margin-bottom:6px;">
              ${alt.message}
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">
              Recommended Action: <strong style="color:var(--accent-teal);">${alt.recommended_action || 'INSPECT'}</strong>
              • Time: ${new Date(alt.created_at).toLocaleTimeString()}
            </div>
            <div style="display:flex; gap:8px;">
              <a href="/bin-details.html?id=${alt.container_id}" class="btn btn-secondary btn-sm">Inspect Bin</a>
              ${alt.status === 'NEW' ? `
                <button class="btn btn-primary btn-sm" onclick="AlertsManager.acknowledge(${alt.id})">Acknowledge Alert</button>
              ` : ''}
              ${['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(alt.status) ? `
                <button class="btn btn-warning btn-sm" onclick="AlertsManager.resolve(${alt.id})">Mark Resolved</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = `<div class="text-danger">Failed loading system alert matrix.</div>`;
    }
  }

  static async acknowledge(id) {
    await ApiClient.post(`/alerts/${id}/acknowledge/`, {});
    Components.showToast('Alert acknowledged.', 'info');
    this.loadAlerts();
  }

  static async resolve(id) {
    await ApiClient.post(`/alerts/${id}/resolve/`, {});
    Components.showToast('Alert marked RESOLVED.', 'success');
    this.loadAlerts();
  }

  static setupListeners() {
    ['filter-alert-severity', 'filter-alert-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadAlerts());
    });
  }
}
