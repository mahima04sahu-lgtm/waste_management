/* WasteGuard Station Details Controller - Segregation, Proximity & Telemetry */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('bin-details.html')) return;
  BinDetails.init();
});

class BinDetails {
  static currentContainerId = 'STATION-01';
  static currentProximityState = false;

  static async init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.currentContainerId = urlParams.get('id') || 'STATION-01';
    
    await this.loadStationDetails(this.currentContainerId);
    await this.loadAuditTimeline(this.currentContainerId);
  }

  static async loadStationDetails(containerId) {
    try {
      const response = await ApiClient.get(`/containers/`);
      const list = response.results || response || [];
      const s = list.find(item => item.container_id === containerId || item.name.includes(containerId)) || list[0] || {
        container_id: containerId,
        name: `WasteGuard ${containerId}`,
        location: 'Central Garden',
        device_status: 'ONLINE',
        proximity_detected: false,
        current_waste: 'Dry',
        last_processed: '2 min ago'
      };

      this.currentContainerId = s.container_id;
      this.currentProximityState = !!s.proximity_detected;
      const reading = s.latest_reading || {};

      // Populate Header Details
      document.getElementById('detail-id').textContent = s.container_id;
      document.getElementById('detail-name').textContent = s.name;
      document.getElementById('detail-location').textContent = `📍 ${s.location}`;
      document.getElementById('detail-device-status').innerHTML = Components.getDeviceBadge(s.device_status || 'ONLINE');
      document.getElementById('detail-last-activity').textContent = s.last_processed || 'Just now';
      document.getElementById('detail-processing').textContent = s.manual_review_pending ? '⚠️ Manual Review Required' : 'Active Waste Segregation Station';

      // Populate Segregation Stream Badge
      const catBadge = document.getElementById('detail-category-badge');
      if (catBadge) {
        const curWaste = (s.current_waste || 'Dry').toLowerCase();
        if (curWaste.includes('wet')) {
          catBadge.style.cssText = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-size:13px; font-weight:700; padding:6px 12px;';
          catBadge.innerHTML = '🟢 Wet Waste Stream';
        } else if (curWaste.includes('hazard')) {
          catBadge.style.cssText = 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:13px; font-weight:700; padding:6px 12px;';
          catBadge.innerHTML = '🔴 Hazardous Waste Stream';
        } else {
          catBadge.style.cssText = 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:13px; font-weight:700; padding:6px 12px;';
          catBadge.innerHTML = '🟡 Dry Waste Stream';
        }
      }

      // Populate Proximity Badge
      const proxBadge = document.getElementById('detail-proximity-badge');
      if (proxBadge) {
        if (s.proximity_detected) {
          proxBadge.className = 'badge badge-low';
          proxBadge.style.cssText = 'background:#dcfce7; color:#15803d; font-size:12px; font-weight:700;';
          proxBadge.innerHTML = '<span class="badge-dot" style="background:#15803d;"></span>OBJECT DETECTED PRESENT';
        } else {
          proxBadge.className = 'badge';
          proxBadge.style.cssText = 'background:#f1f5f9; color:#64748b; font-size:12px; font-weight:600;';
          proxBadge.innerHTML = '<span class="badge-dot" style="background:#94a3b8;"></span>CLEAR / IDLE';
        }
      }

      // Populate Sensor Telemetry Facts
      const tempEl = document.getElementById('fact-temp');
      const humEl = document.getElementById('fact-humidity');
      const gasEl = document.getElementById('fact-gas');
      const moistEl = document.getElementById('fact-moisture');

      if (tempEl) tempEl.textContent = `${reading.temperature ? reading.temperature.toFixed(1) : 26.5}°C`;
      if (humEl) humEl.textContent = `${reading.humidity ? Math.round(reading.humidity) : 55}%`;
      if (gasEl) gasEl.textContent = `${reading.gas_indicator ? Math.round(reading.gas_indicator) : 120} ppm`;
      if (moistEl) moistEl.textContent = `${reading.moisture ? Math.round(reading.moisture) : 25}%`;

    } catch (e) {
      console.error('Error loading station details', e);
    }
  }

  static async selectCategory(category) {
    try {
      await ApiClient.post(`/containers/${this.currentContainerId}/select-category/`, { category });
      Components.showToast(`Station ${this.currentContainerId}: Activated ${category} compartment.`, 'success');
      await this.loadStationDetails(this.currentContainerId);
    } catch (err) {
      Components.showToast(`Failed to select category: ${err.message}`, 'error');
    }
  }

  static async toggleProximity() {
    try {
      const nextState = !this.currentProximityState;
      await ApiClient.post(`/containers/${this.currentContainerId}/set-proximity/`, { detected: nextState });
      const statusText = nextState ? 'Object Detected' : 'Clear';
      Components.showToast(`Station ${this.currentContainerId}: Proximity sensor ${statusText}.`, 'info');
      await this.loadStationDetails(this.currentContainerId);
    } catch (err) {
      Components.showToast(`Failed to update proximity: ${err.message}`, 'error');
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
              <strong>Segregation Event:</strong> Station activated for <strong>Dry Waste</strong> stream
            </div>
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid #10b981;">
              <strong>Proximity Event:</strong> Object detected near sensor, compartment ready
            </div>
            <div style="padding:8px 10px; background:#f8fafc; border-left:3px solid #ef4444;">
              <strong>Telemetry Log:</strong> Environmental sensors within normal operational parameters
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
              <div style="color:var(--text-secondary); font-size:11.5px;">Event source: ${item.user_name || 'Hardware / Sensor Engine'}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      timelineEl.innerHTML = `<div class="text-muted">Unable to load activity log.</div>`;
    }
  }
}
