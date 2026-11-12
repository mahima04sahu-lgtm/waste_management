/* WasteGuard Stations List Controller - Segregation, Proximity & Telemetry */

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
          { container_id: 'STATION-01', name: 'WasteGuard Station 01', location: 'Central Garden', device_status: 'ONLINE', proximity_detected: true, current_waste: 'Dry', last_processed: '2 min ago', manual_review_pending: false },
          { container_id: 'STATION-02', name: 'WasteGuard Station 02', location: 'Cafeteria', device_status: 'ONLINE', proximity_detected: true, current_waste: 'Wet', last_processed: '1 min ago', manual_review_pending: true, manual_review_reason: 'Classification verification requested' },
          { container_id: 'STATION-03', name: 'WasteGuard Station 03', location: 'Academic Block', device_status: 'ONLINE', proximity_detected: false, current_waste: 'Dry', last_processed: '4 min ago', manual_review_pending: false },
          { container_id: 'STATION-04', name: 'WasteGuard Station 04', location: 'Hostel', device_status: 'ONLINE', proximity_detected: false, current_waste: 'Hazard', last_processed: '3 min ago', manual_review_pending: true, manual_review_reason: 'Hazardous stream review' },
          { container_id: 'STATION-05', name: 'WasteGuard Station 05', location: 'Parking Area', device_status: 'ONLINE', proximity_detected: false, current_waste: 'Dry', last_processed: '10 min ago', manual_review_pending: false }
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
        const reading = s.latest_reading || {};
        const temp = reading.temperature !== undefined ? reading.temperature.toFixed(1) : '26.5';
        const humidity = reading.humidity !== undefined ? Math.round(reading.humidity) : '55';
        const gas = reading.gas_indicator !== undefined ? Math.round(reading.gas_indicator) : '120';
        const moisture = reading.moisture !== undefined ? Math.round(reading.moisture) : '25';

        const curWaste = (s.current_waste || 'Dry').toLowerCase();
        let catBadgeStyle = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;';
        let catIcon = '🟡';
        let catLabel = 'Dry Waste';

        if (curWaste.includes('wet')) {
          catBadgeStyle = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;';
          catIcon = '🟢';
          catLabel = 'Wet Waste';
        } else if (curWaste.includes('hazard')) {
          catBadgeStyle = 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;';
          catIcon = '🔴';
          catLabel = 'Hazardous Waste';
        }

        const isProximityActive = !!s.proximity_detected;
        const proxBadge = isProximityActive 
          ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700;"><span class="badge-dot" style="background:#15803d;"></span>OBJECT DETECTED</span>`
          : `<span class="badge" style="background:#f1f5f9; color:#64748b; font-weight:600;"><span class="badge-dot" style="background:#94a3b8;"></span>CLEAR / IDLE</span>`;

        return `
          <div class="station-card">
            <div class="station-card-header">
              <div>
                <div class="station-title">${s.name}</div>
                <div class="station-location">📍 <strong>${s.location}</strong></div>
              </div>
              <span class="badge ${s.device_status === 'ONLINE' ? 'badge-low' : 'badge-critical'}">${s.device_status || 'ONLINE'}</span>
            </div>

            <!-- Segregation & Proximity Status Box -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-sm); padding:12px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Segregation Stream</span>
                <span class="badge" style="${catBadgeStyle}; font-weight:700; font-size:12px;">
                  ${catIcon} ${catLabel}
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Proximity Sensor</span>
                ${proxBadge}
              </div>
            </div>

            <!-- Live Sensor Telemetry Strip -->
            <div>
              <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px;">
                Sensor Telemetry
              </div>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; text-align:center;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:6px 2px;">
                  <div style="font-size:10px; color:var(--text-secondary);">Temp</div>
                  <strong style="font-size:12px; color:var(--text-main);">${temp}°C</strong>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:6px 2px;">
                  <div style="font-size:10px; color:var(--text-secondary);">Humidity</div>
                  <strong style="font-size:12px; color:var(--text-main);">${humidity}%</strong>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:6px 2px;">
                  <div style="font-size:10px; color:var(--text-secondary);">VOC Gas</div>
                  <strong style="font-size:12px; color:${gas >= 350 ? 'var(--status-critical)' : 'var(--text-main)'};">${gas} ppm</strong>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:4px; padding:6px 2px;">
                  <div style="font-size:10px; color:var(--text-secondary);">Moisture</div>
                  <strong style="font-size:12px; color:${moisture >= 60 ? 'var(--status-critical)' : 'var(--text-main)'};">${moisture}%</strong>
                </div>
              </div>
            </div>

            <div class="station-meta-row" style="font-size:11px; color:var(--text-secondary);">
              <div>Activity: <strong>${s.last_processed || 'Just now'}</strong></div>
            </div>

            ${s.manual_review_pending ? `
              <div style="background:#fffbe6; border:1px solid #ffe58f; padding:6px 10px; border-radius:4px; font-size:11px; color:#d48806; font-weight:600; display:flex; align-items:center; gap:6px;">
                <span>⚠️</span> <span>${s.manual_review_reason || 'Manual review pending'}</span>
              </div>
            ` : ''}

            <a href="bin-details.html?id=${s.container_id}" class="btn btn-secondary btn-sm" style="text-align:center; justify-content:center; margin-top:4px;">View Station Details →</a>
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
