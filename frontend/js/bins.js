/* WasteGuard Stations List Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('bins.html')) return;
  BinsManager.init();
});

class BinsManager {
  static async init() {
    await this.loadContainers();
    this.setupFilters();
  }

  static async loadContainers() {
    const gridEl = document.getElementById('stations-list-grid');
    if (!gridEl) return;

    try {
      const ward = document.getElementById('filter-ward')?.value || '';
      const status = document.getElementById('filter-status')?.value || '';
      const search = document.getElementById('filter-search')?.value || '';

      const response = await ApiClient.get('/containers/');
      let stations = response.results || response || [];

      if (!stations || stations.length === 0) {
        stations = [
          { container_id: 'STATION-01', name: 'WasteGuard Station 01', location: 'Central Garden', device_status: 'ONLINE', wet_fill_pct: 42, dry_fill_pct: 68, hazard_fill_pct: 24, current_waste: 'Dry', last_processed: '2 min ago', manual_review_pending: false },
          { container_id: 'STATION-02', name: 'WasteGuard Station 02', location: 'Cafeteria', device_status: 'ONLINE', wet_fill_pct: 78, dry_fill_pct: 85, hazard_fill_pct: 12, current_waste: 'Wet', last_processed: '1 min ago', manual_review_pending: true, manual_review_reason: 'Low-confidence classification detected' },
          { container_id: 'STATION-03', name: 'WasteGuard Station 03', location: 'Academic Block', device_status: 'ONLINE', wet_fill_pct: 30, dry_fill_pct: 55, hazard_fill_pct: 10, current_waste: 'Dry', last_processed: '4 min ago', manual_review_pending: false },
          { container_id: 'STATION-04', name: 'WasteGuard Station 04', location: 'Hostel', device_status: 'ONLINE', wet_fill_pct: 65, dry_fill_pct: 72, hazard_fill_pct: 40, current_waste: 'Hazard', last_processed: '3 min ago', manual_review_pending: true, manual_review_reason: 'Manual review pending' },
          { container_id: 'STATION-05', name: 'WasteGuard Station 05', location: 'Parking Area', device_status: 'ONLINE', wet_fill_pct: 20, dry_fill_pct: 45, hazard_fill_pct: 5, current_waste: 'Dry', last_processed: '10 min ago', manual_review_pending: false }
        ];
      }

      if (ward) {
        stations = stations.filter(s => s.location.toLowerCase().includes(ward.toLowerCase()));
      }
      if (status) {
        stations = stations.filter(s => s.device_status === status);
      }
      if (search) {
        stations = stations.filter(s => 
          s.name.toLowerCase().includes(search.toLowerCase()) || 
          s.location.toLowerCase().includes(search.toLowerCase()) ||
          s.container_id.toLowerCase().includes(search.toLowerCase())
        );
      }

      gridEl.innerHTML = stations.map(s => {
        const wet = Math.round(s.wet_fill_pct ?? 40);
        const dry = Math.round(s.dry_fill_pct ?? 60);
        const hazard = Math.round(s.hazard_fill_pct ?? 20);

        return `
          <div class="station-card">
            <div class="station-card-header">
              <div>
                <div class="station-title">${s.name}</div>
                <div class="station-location">📍 <strong>${s.location}</strong></div>
              </div>
              <span class="badge ${s.device_status === 'ONLINE' ? 'badge-low' : 'badge-critical'}">${s.device_status || 'ONLINE'}</span>
            </div>

            <div class="bin-status-container">
              <div class="bin-status-title">Bin Status</div>
              <div class="bin-fill-row">
                <span style="color:#10b981; min-width:70px;">🟢 Wet</span>
                <div class="bin-fill-bar-bg"><div class="bin-fill-bar-fill" style="width:${wet}%; background:#10b981;"></div></div>
                <span>${wet}%</span>
              </div>
              <div class="bin-fill-row">
                <span style="color:#f59e0b; min-width:70px;">🟡 Dry</span>
                <div class="bin-fill-bar-bg"><div class="bin-fill-bar-fill" style="width:${dry}%; background:#f59e0b;"></div></div>
                <span>${dry}%</span>
              </div>
              <div class="bin-fill-row">
                <span style="color:#ef4444; min-width:70px;">🔴 Hazard</span>
                <div class="bin-fill-bar-bg"><div class="bin-fill-bar-fill" style="width:${hazard}%; background:#ef4444;"></div></div>
                <span>${hazard}%</span>
              </div>
            </div>

            <div class="station-meta-row">
              <div>Current waste: <strong>${s.current_waste || 'Dry'}</strong></div>
              <div>Last processed: <strong>${s.last_processed || '2 min ago'}</strong></div>
            </div>

            ${s.manual_review_pending ? `
              <div style="background:#fffbe6; border:1px solid #ffe58f; padding:6px 10px; border-radius:4px; font-size:11px; color:#d48806; font-weight:600; display:flex; align-items:center; gap:6px;">
                <span>⚠️</span> <span>${s.manual_review_reason || 'Manual review pending'}</span>
              </div>
            ` : ''}

            <a href="/bin-details.html?id=${s.container_id}" class="btn btn-secondary btn-sm" style="text-align:center; margin-top:4px;">View Station Details →</a>
          </div>
        `;
      }).join('');
    } catch (e) {
      gridEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--status-critical); grid-column:1/-1;">Error loading stations list.</div>`;
    }
  }

  static setupFilters() {
    ['filter-ward', 'filter-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadContainers());
    });

    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.loadContainers());
    }
  }
}
