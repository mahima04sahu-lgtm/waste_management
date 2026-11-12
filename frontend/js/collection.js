/* WasteGuard Station Collection & Dispatch Controller */

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
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px;">No active collection records in dispatch queue.</td></tr>`;
        return;
      }

      tableBody.innerHTML = records.map(rec => {
        return `
        <tr>
          <td>
            <a href="/bin-details.html?id=${rec.container_id}" style="font-weight:700; color:var(--accent-teal);">
              ${rec.container_id}
            </a>
          </td>
          <td>${rec.ward} (${rec.location})</td>
          <td>${rec.worker_name || 'Unassigned Operator'}</td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">Active Stream</span></td>
          <td><span class="badge" style="background:#f1f5f9; color:#64748b;">Monitored</span></td>
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
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--status-critical);">Failed loading collection queue.</td></tr>`;
    }
  }

  static completeCollectionModal(id, containerId) {
    Components.confirmActionDialog({
      title: `Confirm Station Collection: ${containerId}`,
      message: `Confirm that waste from station <strong>${containerId}</strong> has been cleared and prepped for active segregation.`,
      actionLabel: 'Mark Collection Complete',
      onConfirm: async () => {
        await ApiClient.post(`/collection/${id}/complete/`, {});
        Components.showToast(`Collection completed for ${containerId}`, 'success');
        this.loadCollectionQueue();
      }
    });
  }
}
