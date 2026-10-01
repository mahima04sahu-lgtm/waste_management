/* HazGuard Component UI Utilities */

class Components {
  static getRiskBadge(level) {
    const lvl = (level || 'LOW').toUpperCase();
    let badgeClass = 'badge-low';
    if (lvl === 'CRITICAL') badgeClass = 'badge-critical';
    else if (lvl === 'HIGH') badgeClass = 'badge-high';
    else if (lvl === 'MEDIUM') badgeClass = 'badge-medium';
    else if (lvl === 'OFFLINE') badgeClass = 'badge-offline';

    return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${lvl} RISK</span>`;
  }

  static getDeviceBadge(status) {
    const st = (status || 'ONLINE').toUpperCase();
    const badgeClass = st === 'ONLINE' ? 'badge-low' : 'badge-offline';
    return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${st}</span>`;
  }

  static getActionBadge(type) {
    const tp = type || 'NO ACTION';
    let badgeClass = 'badge-low';
    if (['ISOLATE', 'SPECIALIST REQUIRED'].includes(tp)) badgeClass = 'badge-critical';
    else if (['MECHANICALLY TRANSFER', 'HANDLE NOW'].includes(tp)) badgeClass = 'badge-high';
    else if (['INSPECT', 'CLEAN / MAINTENANCE'].includes(tp)) badgeClass = 'badge-medium';

    return `<span class="badge ${badgeClass}">${tp}</span>`;
  }

  static showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  }

  static openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  }

  static closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }

  static confirmActionDialog({ title, message, actionLabel, onConfirm, isDanger = false }) {
    let overlay = document.getElementById('confirm-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">${title || 'Confirm Operational Decision'}</h3>
          <button class="modal-close" onclick="Components.closeModal('confirm-modal-overlay')">&times;</button>
        </div>
        <div class="modal-body" style="font-size:14px; color:var(--text-secondary); line-height:1.5;">
          ${message}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Components.closeModal('confirm-modal-overlay')">Cancel</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-dialog-btn">${actionLabel || 'Confirm Action'}</button>
        </div>
      </div>
    `;

    overlay.classList.add('active');
    document.getElementById('confirm-dialog-btn').onclick = async () => {
      overlay.classList.remove('active');
      if (onConfirm) await onConfirm();
    };
  }
}
