/* WasteGuard - Industrial IoT Operations Dashboard Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('dashboard.html') && window.location.pathname !== '/') return;
  Dashboard.init();
});

class Dashboard {
  static stations = [];
  static alerts = [];
  static pollTimer = null;
  static isUpdating = false;

  static async init() {
    // Populate user profile in navbar if AuthManager exists
    if (window.AuthManager) {
      AuthManager.renderUserNav();
    }

    this.setupEventListeners();
    await this.fetchDashboardData();

    // Auto-refresh station telemetry every 8 seconds
    this.pollTimer = setInterval(() => {
      this.fetchDashboardData(true);
    }, 8000);
  }

  static setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderStationsGrid());
    }

    // Stream filter dropdown
    const streamSelect = document.getElementById('filter-stream');
    if (streamSelect) {
      streamSelect.addEventListener('change', () => this.renderStationsGrid());
    }

    // Proximity filter dropdown
    const proximitySelect = document.getElementById('filter-proximity');
    if (proximitySelect) {
      proximitySelect.addEventListener('change', () => this.renderStationsGrid());
    }

    // Manual refresh button
    const refreshBtn = document.getElementById('btn-manual-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const icon = document.getElementById('refresh-icon');
        if (icon) icon.style.transform = 'rotate(360deg)';
        await this.fetchDashboardData(false);
        setTimeout(() => {
          if (icon) icon.style.transform = 'none';
        }, 500);
      });
    }
  }

  static async fetchDashboardData(isBackground = false) {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      // Parallel fetch of containers and alerts from actual backend APIs
      const [containersResp, alertsResp] = await Promise.all([
        ApiClient.get('/containers/').catch(err => {
          console.error('[Dashboard] Error fetching containers:', err);
          return null;
        }),
        ApiClient.get('/alerts/').catch(err => {
          console.error('[Dashboard] Error fetching alerts:', err);
          return null;
        })
      ]);

      if (containersResp) {
        this.stations = containersResp.results || containersResp || [];
      }

      if (alertsResp) {
        this.alerts = alertsResp.results || alertsResp || [];
      }

      this.updateKPIs();
      this.renderStationsGrid();
      this.renderAlertsSection();

      const statusText = document.getElementById('system-status-text');
      if (statusText) statusText.textContent = 'Live Telemetry Active';
    } catch (err) {
      console.error('[Dashboard] Fatal fetch error:', err);
      const grid = document.getElementById('dashboard-stations-grid');
      if (grid && !isBackground) {
        grid.innerHTML = `
          <div class="state-empty" style="border-color:var(--status-critical); background:#fff5f5;">
            <div style="font-size:16px; font-weight:700; color:var(--status-critical); margin-bottom:6px;">
              ⚠️ Unable to Load Station Telemetry
            </div>
            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
              ${err.message || 'Check Django backend connection.'}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="Dashboard.fetchDashboardData(false)">
              Retry Connection
            </button>
          </div>
        `;
      }
    } finally {
      this.isUpdating = false;
    }
  }

  static updateKPIs() {
    const stations = this.stations || [];
    const total = stations.length;
    const online = stations.filter(s => s.device_status === 'ONLINE').length;
    const offline = total - online;

    // Proximity presence count
    const proximityCount = stations.filter(s => s.proximity_detected).length;

    // Stream distribution counts
    let dryCount = 0;
    let wetCount = 0;
    let hazCount = 0;

    stations.forEach(s => {
      const cat = (s.waste_category || '').toUpperCase();
      const current = (s.current_waste || '').toLowerCase();
      if (cat === 'DRY' || current.includes('dry')) dryCount++;
      else if (cat === 'WET' || current.includes('wet')) wetCount++;
      else if (cat === 'HAZARDOUS' || current.includes('hazard')) hazCount++;
    });

    // Safety alerts & review flags count
    const alertsCount = (this.alerts || []).length;
    const reviewPendingCount = stations.filter(s => s.manual_review_pending).length;
    const totalSafetyIssues = alertsCount + reviewPendingCount;

    // 1. Total Stations Card
    const totalCountEl = document.getElementById('kpi-total-count');
    if (totalCountEl) totalCountEl.textContent = total;

    const connectSubEl = document.getElementById('kpi-connectivity-sub');
    if (connectSubEl) {
      if (offline === 0) {
        connectSubEl.innerHTML = `<span class="badge-dot" style="background:#15803d;"></span><span>All ${total} Stations Online</span>`;
      } else {
        connectSubEl.innerHTML = `<span class="badge-dot" style="background:#ea580c;"></span><span>${online} Online • ${offline} Offline</span>`;
      }
    }

    // 2. Proximity Presence Card
    const proxCountEl = document.getElementById('kpi-proximity-count');
    if (proxCountEl) proxCountEl.textContent = proximityCount;

    const proxSubEl = document.getElementById('kpi-proximity-sub');
    if (proxSubEl) {
      if (proximityCount > 0) {
        proxSubEl.innerHTML = `<span class="badge-dot" style="background:#059669;"></span><strong>${proximityCount} station${proximityCount > 1 ? 's' : ''} occupied</strong>`;
      } else {
        proxSubEl.innerHTML = `<span class="badge-dot" style="background:#94a3b8;"></span><span>All hoppers clear</span>`;
      }
    }

    // 3. Stream Distribution Card
    const streamDistTextEl = document.getElementById('kpi-stream-distribution-text');
    if (streamDistTextEl) {
      streamDistTextEl.innerHTML = `
        <span style="color:#0284c7; font-weight:700;">Dry: ${dryCount}</span> • 
        <span style="color:#15803d; font-weight:700;">Wet: ${wetCount}</span> • 
        <span style="color:#dc2626; font-weight:700;">Haz: ${hazCount}</span>
      `;
    }

    // 4. Safety & Reviews Card
    const safetyCountEl = document.getElementById('kpi-safety-count');
    if (safetyCountEl) safetyCountEl.textContent = totalSafetyIssues;

    const safetySubEl = document.getElementById('kpi-safety-sub');
    if (safetySubEl) {
      if (totalSafetyIssues > 0) {
        safetySubEl.innerHTML = `<span class="badge-dot" style="background:#d97706;"></span><span>${reviewPendingCount} pending review flag${reviewPendingCount > 1 ? 's' : ''}</span>`;
      } else {
        safetySubEl.innerHTML = `<span class="badge-dot" style="background:#15803d;"></span><span>Normal operational baseline</span>`;
      }
    }
  }

  static renderStationsGrid() {
    const gridEl = document.getElementById('dashboard-stations-grid');
    if (!gridEl) return;

    const searchQuery = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
    const streamFilter = (document.getElementById('filter-stream')?.value || '').trim().toUpperCase();
    const proximityFilter = (document.getElementById('filter-proximity')?.value || '').trim().toUpperCase();

    let filtered = [...(this.stations || [])];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(s =>
        (s.container_id || '').toLowerCase().includes(searchQuery) ||
        (s.name || '').toLowerCase().includes(searchQuery) ||
        (s.location || '').toLowerCase().includes(searchQuery) ||
        (s.ward || '').toLowerCase().includes(searchQuery)
      );
    }

    // Stream filter
    if (streamFilter) {
      filtered = filtered.filter(s => {
        const cat = (s.waste_category || '').toUpperCase();
        const cur = (s.current_waste || '').toUpperCase();
        if (streamFilter === 'DRY') return cat === 'DRY' || cur.includes('DRY');
        if (streamFilter === 'WET') return cat === 'WET' || cur.includes('WET');
        if (streamFilter === 'HAZARDOUS') return cat === 'HAZARDOUS' || cur.includes('HAZARD');
        return true;
      });
    }

    // Proximity filter
    if (proximityFilter) {
      if (proximityFilter === 'ACTIVE') {
        filtered = filtered.filter(s => s.proximity_detected);
      } else if (proximityFilter === 'IDLE') {
        filtered = filtered.filter(s => !s.proximity_detected);
      }
    }

    // Update count label
    const countLabel = document.getElementById('stations-count-label');
    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${this.stations.length} station${this.stations.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="state-empty">
          <div style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
            No Waste Stations Match Current Filters
          </div>
          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
            Adjust search term, active stream, or hopper state filters.
          </div>
          <button class="btn btn-secondary btn-sm" onclick="Dashboard.clearFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    // Render station cards
    gridEl.innerHTML = filtered.map(s => this.createStationCardHtml(s)).join('');
  }

  static createStationCardHtml(s) {
    const isOnline = s.device_status === 'ONLINE';
    const isProximityActive = !!s.proximity_detected;

    // Waste Category formatting
    const category = (s.waste_category || '').toUpperCase();
    const curWaste = (s.current_waste || 'Dry').toLowerCase();

    let streamClass = 'dry';
    let streamLabel = 'Dry Waste Stream';
    let streamIcon = '📦';
    let streamColor = '#0284c7';

    if (category === 'WET' || curWaste.includes('wet')) {
      streamClass = 'wet';
      streamLabel = 'Wet Waste Stream';
      streamIcon = '🍃';
      streamColor = '#15803d';
    } else if (category === 'HAZARDOUS' || curWaste.includes('hazard')) {
      streamClass = 'hazardous';
      streamLabel = 'Hazardous Waste Stream';
      streamIcon = '☣️';
      streamColor = '#dc2626';
    }

    // Sensor Readings from real latest_reading (if available)
    const reading = s.latest_reading || {};
    const hasReading = reading && typeof reading.temperature !== 'undefined';
    const temp = hasReading ? Number(reading.temperature).toFixed(1) : '25.0';
    const humidity = hasReading ? Math.round(Number(reading.humidity)) : 50;
    const gas = hasReading && typeof reading.gas_indicator !== 'undefined' ? Math.round(Number(reading.gas_indicator)) : 0;
    const moisture = hasReading ? Math.round(Number(reading.moisture)) : 20;

    // Gas alert check (threshold >= 350 ppm)
    const isGasAlert = gas >= 350;
    const isMoistAlert = moisture >= 60;

    // Real timestamp formatting
    const updatedTimeStr = this.formatTimestamp(s.updated_at || reading.timestamp);

    return `
      <div class="station-card" id="card-${s.container_id}">
        <!-- Header: Station ID, Name, Location & Device Status -->
        <div class="station-card-header">
          <div class="station-identity">
            <span class="station-code">${this.escapeHtml(s.container_id)}</span>
            <span class="station-title">${this.escapeHtml(s.name || s.container_id)}</span>
            <span class="station-location">📍 ${this.escapeHtml(s.location || 'Campus Ward')}</span>
          </div>
          <span class="device-badge ${isOnline ? 'online' : 'offline'}">
            <span class="badge-dot" style="background:${isOnline ? '#059669' : '#64748b'};"></span>
            ${isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <!-- Proximity Presence Status -->
        <div class="proximity-banner ${isProximityActive ? 'active' : 'idle'}">
          <div class="proximity-header-row">
            <span class="proximity-label-text">Intake Proximity Sensor</span>
            <span class="proximity-status-pill ${isProximityActive ? 'active' : 'idle'}">
              <span class="radar-dot"></span>
              ${isProximityActive ? 'OBJECT DETECTED' : 'CLEAR / IDLE'}
            </span>
          </div>
          <div class="scope-disclaimer-note">
            ${isProximityActive 
              ? 'Physical object or person present at hopper intake.' 
              : 'Intake hopper clear and ready for disposal.'}
          </div>
        </div>

        <!-- Active Segregation Stream Banner -->
        <div class="stream-banner ${streamClass}">
          <div class="stream-title-group">
            <span class="stream-category-label">Active Segregation Stream</span>
            <span class="stream-name">${streamIcon} ${streamLabel}</span>
          </div>
          <span style="font-size:11px; font-weight:700; color:${streamColor}; background:#ffffff; padding:2px 8px; border-radius:4px; border:1px solid currentColor;">
            ${category || 'DRY'}
          </span>
        </div>

        <!-- Environmental Telemetry Strip -->
        <div class="telemetry-section">
          <div class="telemetry-section-header">
            <span>Environmental Telemetry</span>
            <span style="font-size:9.5px; color:#94a3b8; font-weight:600;">Hardware Telemetry</span>
          </div>
          <div class="telemetry-grid">
            <div class="telemetry-tile">
              <div class="telemetry-tile-name">Temp</div>
              <div class="telemetry-tile-value">${temp}°C</div>
            </div>
            <div class="telemetry-tile">
              <div class="telemetry-tile-name">Humidity</div>
              <div class="telemetry-tile-value">${humidity}%</div>
            </div>
            <div class="telemetry-tile">
              <div class="telemetry-tile-name">VOC Gas</div>
              <div class="telemetry-tile-value ${isGasAlert ? 'alert' : ''}">${gas} ppm</div>
            </div>
            <div class="telemetry-tile">
              <div class="telemetry-tile-name">Moisture</div>
              <div class="telemetry-tile-value ${isMoistAlert ? 'alert' : ''}">${moisture}%</div>
            </div>
          </div>
          <div class="telemetry-footer-note">
            <span>Simulated / Demo Sensor Readings</span>
            ${isGasAlert ? '<span style="color:var(--status-critical); font-weight:700;">⚠️ VOC Gas High</span>' : ''}
          </div>
        </div>

        <!-- Stream Selection Operational Controls -->
        <div class="stream-controls-section">
          <div class="stream-controls-header">
            <span class="stream-controls-title">Designate Stream</span>
            <span style="font-size:10px; color:#64748b;">Operator Action</span>
          </div>
          <div class="stream-buttons-group">
            <button 
              class="btn-stream ${category === 'DRY' ? 'active-dry' : ''}" 
              id="btn-dry-${s.container_id}"
              onclick="Dashboard.selectCategory('${s.container_id}', 'DRY', this)"
            >
              ${category === 'DRY' ? '✓ ' : ''}Dry
            </button>
            <button 
              class="btn-stream ${category === 'WET' ? 'active-wet' : ''}" 
              id="btn-wet-${s.container_id}"
              onclick="Dashboard.selectCategory('${s.container_id}', 'WET', this)"
            >
              ${category === 'WET' ? '✓ ' : ''}Wet
            </button>
            <button 
              class="btn-stream ${category === 'HAZARDOUS' ? 'active-hazardous' : ''}" 
              id="btn-haz-${s.container_id}"
              onclick="Dashboard.selectCategory('${s.container_id}', 'HAZARDOUS', this)"
            >
              ${category === 'HAZARDOUS' ? '✓ ' : ''}Hazard
            </button>
          </div>
        </div>

        <!-- Proximity Sensor Presence Toggle (Demonstration Control) -->
        <div>
          <button 
            class="btn-toggle-presence" 
            onclick="Dashboard.toggleProximity('${s.container_id}', ${isProximityActive}, this)"
          >
            <span>📡</span>
            <span>${isProximityActive ? 'Simulate Intake Clear' : 'Simulate Object Presence'}</span>
          </button>
        </div>

        <!-- Manual Review Pending Alert (if real flag exists) -->
        ${s.manual_review_pending ? `
          <div class="station-review-banner">
            <span>⚠️</span>
            <span>${this.escapeHtml(s.manual_review_reason || 'Manual review pending')}</span>
          </div>
        ` : ''}

        <!-- Footer: Real Timestamp & Details Link -->
        <div class="station-footer">
          <span>Updated: <strong>${updatedTimeStr}</strong></span>
          <a href="bin-details.html?id=${encodeURIComponent(s.container_id)}" class="station-detail-link">
            Station Telemetry &amp; Logs →
          </a>
        </div>
      </div>
    `;
  }

  static async selectCategory(containerId, category, buttonEl) {
    if (!containerId || !category) return;

    const originalText = buttonEl ? buttonEl.innerHTML : '';
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Updating...';
    }

    try {
      const response = await ApiClient.post(`/containers/${containerId}/select-category/`, { category });
      
      const label = response?.selected_category || category;
      Components.showToast(`Station ${containerId}: Active stream set to ${label}.`, 'success');

      // Immediate refresh to update station card and KPIs
      await this.fetchDashboardData(true);
    } catch (err) {
      console.error('[Dashboard] Failed to select category:', err);
      Components.showToast(`Failed to update stream: ${err.message || 'Server error'}`, 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalText;
      }
    }
  }

  static async toggleProximity(containerId, currentDetected, buttonEl) {
    if (!containerId) return;

    const nextState = !currentDetected;
    const originalText = buttonEl ? buttonEl.innerHTML : '';
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Updating state...';
    }

    try {
      await ApiClient.post(`/containers/${containerId}/set-proximity/`, { proximity_detected: nextState });

      const stateText = nextState ? 'Object Detected' : 'Hopper Clear';
      Components.showToast(`Station ${containerId}: Proximity sensor set to ${stateText}.`, 'info');

      // Refresh data
      await this.fetchDashboardData(true);
    } catch (err) {
      console.error('[Dashboard] Failed to toggle proximity:', err);
      Components.showToast(`Failed to update proximity: ${err.message || 'Server error'}`, 'error');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalText;
      }
    }
  }

  static renderAlertsSection() {
    const listEl = document.getElementById('dashboard-alerts-list');
    if (!listEl) return;

    const rawAlerts = this.alerts || [];
    const reviewStations = (this.stations || []).filter(s => s.manual_review_pending);

    if (rawAlerts.length === 0 && reviewStations.length === 0) {
      listEl.innerHTML = `
        <div class="activity-empty-state">
          <div class="icon">🛡️</div>
          <strong style="color:var(--text-primary);">Normal Operational Baseline</strong>
          <div style="margin-top:4px; font-size:12px; color:var(--text-secondary);">
            All ${this.stations.length || 5} monitored stations operating within normal parameters. 0 active hazard alerts or elevated gas detections.
          </div>
        </div>
      `;
      return;
    }

    let itemsHtml = '';

    // Render backend alerts
    rawAlerts.forEach(alt => {
      const isCritical = alt.severity === 'CRITICAL';
      itemsHtml += `
        <div class="alert-row ${isCritical ? 'critical' : ''}">
          <div>
            <div class="alert-info-title">
              ${isCritical ? '🚨 CRITICAL ALERT' : '⚠️ STATION ALERT'}: ${this.escapeHtml(alt.container_id || 'Campus Station')}
            </div>
            <div class="alert-info-desc">
              ${this.escapeHtml(alt.message || 'Abnormal condition detected.')} • Recommended: <strong>${this.escapeHtml(alt.recommended_action || 'Inspect')}</strong>
            </div>
          </div>
          <a href="alerts.html" class="btn btn-secondary btn-sm" style="font-size:11px;">View Alert</a>
        </div>
      `;
    });

    // Render pending review stations
    reviewStations.forEach(s => {
      itemsHtml += `
        <div class="alert-row">
          <div>
            <div class="alert-info-title">
              ⚠️ PENDING OPERATIONAL REVIEW: ${this.escapeHtml(s.name || s.container_id)} (${this.escapeHtml(s.location || 'Campus')})
            </div>
            <div class="alert-info-desc">
              Notice: <strong>${this.escapeHtml(s.manual_review_reason || 'Verification requested')}</strong>
            </div>
          </div>
          <a href="bin-details.html?id=${encodeURIComponent(s.container_id)}" class="btn btn-secondary btn-sm" style="font-size:11px;">
            Review Station →
          </a>
        </div>
      `;
    });

    listEl.innerHTML = itemsHtml;
  }

  static clearFilters() {
    const searchInput = document.getElementById('filter-search');
    const streamSelect = document.getElementById('filter-stream');
    const proxSelect = document.getElementById('filter-proximity');

    if (searchInput) searchInput.value = '';
    if (streamSelect) streamSelect.value = '';
    if (proxSelect) proxSelect.value = '';

    this.renderStationsGrid();
  }

  static formatTimestamp(isoString) {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  }

  static escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
