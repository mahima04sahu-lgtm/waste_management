/* HazGuard Collection Dispatch Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('collection.html')) return;
  CollectionManager.init();
});

class CollectionManager {
  static async init() {
    await this.loadCollectionQueue();
  }

  static async loadCollectionQueue() {
    const tableBody = document.getElementById('collection-table-body');
    if (!tableBody) return;

    try {
      const response = await ApiClient.get('/collection/');
      const records = response.results || response;

      if (!records || records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px;">No active collection records in dispatch queue.</td></tr>`;
        return;
      }

      tableBody.innerHTML = records.map(rec => {
        const pred = rec.time_to_fill_prediction || {};
        let predBadge = '';
        if (pred.threshold_reached || (rec.fill_at_collection >= 80)) {
          predBadge = `<span class="badge badge-critical" style="font-size:11px;">0.0 hrs (80% Reached)</span>`;
        } else if (pred.predicted_hours !== undefined) {
          if (pred.predicted_hours <= 24) {
            predBadge = `<span class="badge badge-medium" style="font-size:11px; font-weight:700;">⏱️ ${pred.predicted_hours} hrs</span>`;
          } else {
            predBadge = `<span style="font-weight:600; color:var(--text-primary);">⏱️ ${pred.predicted_hours} hrs</span>`;
          }
        } else {
          predBadge = `<span style="color:var(--text-muted);">--</span>`;
        }

        return `
        <tr>
          <td>
            <a href="/bin-details.html?id=${rec.container_id}" style="font-weight:700; color:var(--accent-teal);">
              ${rec.container_id}
            </a>
          </td>
          <td>${rec.ward} (${rec.location})</td>
          <td>${rec.worker_name || 'Unassigned Operator'}</td>
          <td style="font-weight:700;">${rec.fill_at_collection || 85}%</td>
          <td>${predBadge}</td>
          <td style="font-weight:600;">${rec.weight_collected ? rec.weight_collected.toFixed(1) + ' kg' : 'Pending'}</td>
          <td><span class="badge badge-medium">${rec.status}</span></td>
          <td>
            ${rec.status !== 'COMPLETED' ? `
              <button class="btn btn-primary btn-sm" onclick="CollectionManager.completeCollectionModal(${rec.id}, '${rec.container_id}')">
                Complete Pickup
              </button>
            ` : `<span style="font-size:12px; color:var(--text-muted);">Collected ✓</span>`}
          </td>
        </tr>
      `;
      }).join('');
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--status-critical);">Failed loading collection queue.</td></tr>`;
    }
  }

  static completeCollectionModal(id, containerId) {
    Components.confirmActionDialog({
      title: `Confirm Waste Collection: ${containerId}`,
      message: `
        Enter final measured waste weight collected for container <strong>${containerId}</strong>:
        <br><br>
        <label class="form-label">Collected Weight (kg):</label>
        <input type="number" step="0.1" id="input-collected-weight" class="form-control" value="22.5">
      `,
      actionLabel: 'Mark Collection Complete',
      onConfirm: async () => {
        const weight = document.getElementById('input-collected-weight')?.value || 22.5;
        await ApiClient.post(`/collection/${id}/complete/`, { weight_collected: weight });
        Components.showToast(`Collection completed for ${containerId} (${weight} kg recorded)`, 'success');
        this.loadCollectionQueue();
      }
    });
  }
}
