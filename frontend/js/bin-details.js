/* WasteGuard Station Details Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('bin-details.html')) return;
  BinDetails.init();
});

class BinDetails {
  static async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const containerId = urlParams.get('id') || 'STATION-01';
    
    await this.loadStationDetails(containerId);
    await this.loadAuditTimeline(containerId);
  }

  static async loadStationDetails(containerId) {
    try {
      const response = await ApiClient.get(`/containers/`);
      const list = response.results || response || [];
      const s = list.find(item => item.container_id === containerId || item.name.includes(containerId)) || list[0] || {
        container_id: 'STATION-01',
        name: 'WasteGuard Station 01',
        location: 'Central Garden',
        device_status: 'ONLINE',
        wet_fill_pct: 42,
        dry_fill_pct: 68,
        hazard_fill_pct: 24,
        current_waste: 'Dry',
        last_processed: '2 min ago'
      };

      const reading = s.latest_reading || {};

      // Populate Header Details
      document.getElementById('detail-id').textContent = s.container_id;
      document.getElementById('detail-name').textContent = s.name;
      document.getElementById('detail-location').textContent = `📍 ${s.location}`;
      document.getElementById('detail-device-status').innerHTML = Components.getDeviceBadge(s.device_status || 'ONLINE');
      document.getElementById('detail-last-activity').textContent = s.last_processed || '2 min ago';
      document.getElementById('detail-processing').textContent = s.manual_review_pending ? '⚠️ Manual Review Required' : 'Automated Tri-Bin Sorting Active';

      // Populate 3-Bin Fill Levels
      const wet = Math.round(s.wet_fill_pct ?? 42);
      const dry = Math.round(s.dry_fill_pct ?? 68);
      const hazard = Math.round(s.hazard_fill_pct ?? 24);

      document.getElementById('fill-val-wet').textContent = `${wet}%`;
      document.getElementById('fill-bar-wet').style.width = `${wet}%`;

      document.getElementById('fill-val-dry').textContent = `${dry}%`;
      document.getElementById('fill-bar-dry').style.width = `${dry}%`;

      document.getElementById('fill-val-hazard').textContent = `${hazard}%`;
      document.getElementById('fill-bar-hazard').style.width = `${hazard}%`;

      // Populate Sensor Telemetry Facts
      const weight = reading.weight || (wet * 0.35);
      document.getElementById('fact-weight').textContent = `${weight.toFixed(1)} kg`;
      document.getElementById('fact-temp').textContent = `${reading.temperature ? reading.temperature.toFixed(1) : 26.5}°C`;
      document.getElementById('fact-humidity').textContent = `${reading.humidity ? reading.humidity.toFixed(0) : 55}%`;
      document.getElementById('fact-gas').textContent = `${reading.gas_indicator ? reading.gas_indicator.toFixed(0) : 120} ppm`;

    } catch (e) {
      console.error('Error loading station details', e);
    }
  }

  static async loadAuditTimeline(containerId) {
    const timelineEl = document.getElementById('audit-timeline-container');
    if (!timelineEl) return;

    try {
      const logs = await ApiClient.get(`/audit-logs/`);
      const list = logs.results || logs || [];

      if (!list || list.length === 0) {
        timelineEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px; font-size:12px;">
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid var(--accent-teal);">
              <strong>Automated Sort Event:</strong> Plastic bottle classified as <strong>Dry</strong> (96% conf)
            </div>
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid #10b981;">
              <strong>Automated Sort Event:</strong> Food waste classified as <strong>Wet</strong> (94% conf)
            </div>
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid #ef4444;">
              <strong>Automated Sort Event:</strong> Chemical container classified as <strong>Hazard</strong> (92% conf)
            </div>
          </div>
        `;
        return;
      }

      timelineEl.innerHTML = list.slice(0, 5).map(item => {
        const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div style="display:flex; gap:12px; margin-bottom:12px; font-size:12.5px;">
            <div style="font-weight:700; color:var(--accent-teal); width:50px; flex-shrink:0;">${dateStr}</div>
            <div style="flex:1;">
              <div style="font-weight:600; color:var(--text-primary);">${item.action}</div>
              <div style="color:var(--text-secondary); font-size:11.5px;">User/System: ${item.user_name || 'Automated Sorting Engine'}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      timelineEl.innerHTML = `<div class="text-muted">Unable to load activity log.</div>`;
    }
  }
}
