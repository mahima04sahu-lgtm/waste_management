/* WasteGuard — Single-Station Arduino Uno Dashboard Controller (wg-dashboard.js)
   Renders real data from backend endpoints. Strictly zero fabricated data. */

document.addEventListener('DOMContentLoaded', () => {
  if (window.AuthManager) AuthManager.renderUserNav();
  DashboardController.init();
});

const DashboardController = {
  pollTimer: null,
  stationId: 'STATION-01',

  async init() {
    this._setupRefreshBtn();
    await this._load();
    // Auto-refresh live prototype data every 2.5 seconds for instant hardware sync
    this.pollTimer = setInterval(() => this._load(true), 2500);
  },

  _setupRefreshBtn() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const icon = document.getElementById('refresh-icon');
      if (icon) icon.style.transform = 'rotate(360deg)';
      await this._load();
      setTimeout(() => { if (icon) icon.style.transform = ''; }, 500);
    });
  },

  async _load(background = false) {
    try {
      const [summaryResp, eventsResp] = await Promise.all([
        ApiClient.get(`/analytics/summary/?station_id=${this.stationId}`).catch(e => {
          console.warn('[Dashboard] Summary error:', e);
          return null;
        }),
        ApiClient.get(`/audit-logs/?action=SEGREGATION_EVENT&page_size=8`).catch(e => {
          console.warn('[Dashboard] Events error:', e);
          return null;
        })
      ]);

      if (summaryResp) {
        this._updateStationHUD(summaryResp);
        this._updateKPIs(summaryResp.kpis || {});
        this._updateSensorHUD(summaryResp);
        this._updateDistribution(summaryResp.category_breakdown || []);
      } else {
        this._setOfflineState();
      }

      const events = eventsResp ? (eventsResp.results || eventsResp || []) : [];
      this._renderEventsTable(events);

      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const label = document.getElementById('last-updated-label');
      if (label) label.textContent = `Sync: ${ts}`;

    } catch (err) {
      console.error('[Dashboard] Render error:', err);
      if (!background) {
        this._setOfflineState();
      }
    }
  },

  _updateStationHUD(data) {
    const station = data.station || {};
    const isOnline = !!station.arduino_connected;
    const badgeWrap = document.getElementById('station-conn-badge');
    const dot = document.getElementById('live-dot');
    const liveText = document.getElementById('live-text');

    if (badgeWrap) {
      badgeWrap.innerHTML = isOnline
        ? '<span class="status-badge status-online">● Arduino Connected</span>'
        : '<span class="status-badge status-offline">○ Arduino Disconnected / Offline</span>';
    }

    if (dot) dot.style.background = isOnline ? '#10b981' : '#94a3b8';
    if (liveText) liveText.textContent = isOnline ? 'Live Sync' : 'Offline';

    const lastSeenEl = document.getElementById('station-last-seen');
    if (lastSeenEl) {
      if (station.last_event_timestamp) {
        lastSeenEl.textContent = this._formatDate(station.last_event_timestamp);
      } else if (station.last_processed && !station.last_processed.includes('No data')) {
        lastSeenEl.textContent = station.last_processed;
      } else {
        lastSeenEl.textContent = 'No events received yet';
      }
    }
  },

  _updateKPIs(kpis) {
    this._setVal('kpi-total-val', kpis.total_events || 0);
    this._setVal('kpi-metal-val', kpis.metal_count || 0);
    this._setVal('kpi-wet-val', kpis.wet_count || 0);
    this._setVal('kpi-dry-val', kpis.dry_count || 0);
  },

  _updateSensorHUD(data) {
    const readings = data.sensor_readings || {};
    const hasData = !!readings.has_data;
    const isOnline = !!(data.station && data.station.arduino_connected);

    const metalValEl = document.getElementById('metal-sensor-val');
    const metalBadgeEl = document.getElementById('metal-sensor-state-badge');
    const moistValEl = document.getElementById('moisture-sensor-val');
    const moistBadgeEl = document.getElementById('moisture-sensor-state-badge');

    if (!hasData && !isOnline) {
      if (metalValEl) metalValEl.textContent = 'Offline / No data';
      if (metalBadgeEl) metalBadgeEl.innerHTML = '<span class="status-badge status-offline">No Data</span>';
      if (moistValEl) moistValEl.textContent = 'Offline / No data';
      if (moistBadgeEl) moistBadgeEl.innerHTML = '<span class="status-badge status-offline">No Data</span>';
      return;
    }

    // Metal Sensor
    if (readings.metal_detected) {
      if (metalValEl) metalValEl.textContent = 'Active (Metal Detected)';
      if (metalBadgeEl) metalBadgeEl.innerHTML = '<span class="cat-badge cat-metal">🔩 Triggered</span>';
    } else {
      if (metalValEl) metalValEl.textContent = 'Inactive (Clear)';
      if (metalBadgeEl) metalBadgeEl.innerHTML = '<span class="status-badge status-online">Clear</span>';
    }

    // Moisture Sensor
    const moistPct = typeof readings.moisture_pct === 'number' ? readings.moisture_pct : 0.0;
    if (moistValEl) moistValEl.textContent = `${moistPct.toFixed(1)}% Moisture`;
    if (moistBadgeEl) {
      if (moistPct >= 45.0) {
        moistBadgeEl.innerHTML = '<span class="cat-badge cat-wet">🍃 Wet Detected</span>';
      } else {
        moistBadgeEl.innerHTML = '<span class="cat-badge cat-dry">📦 Dry (Residual)</span>';
      }
    }
  },

  _updateDistribution(breakdown) {
    let metalPct = 0, wetPct = 0, dryPct = 0;
    let metalCnt = 0, wetCnt = 0, dryCnt = 0;

    breakdown.forEach(item => {
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('metal')) {
        metalPct = item.percentage || 0;
        metalCnt = item.count || 0;
      } else if (cat.includes('wet')) {
        wetPct = item.percentage || 0;
        wetCnt = item.count || 0;
      } else if (cat.includes('dry')) {
        dryPct = item.percentage || 0;
        dryCnt = item.count || 0;
      }
    });

    const segMetal = document.getElementById('seg-metal');
    const segWet = document.getElementById('seg-wet');
    const segDry = document.getElementById('seg-dry');

    if (segMetal) segMetal.style.width = `${metalPct}%`;
    if (segWet) segWet.style.width = `${wetPct}%`;
    if (segDry) segDry.style.width = `${dryPct}%`;

    this._setVal('pct-metal', `${metalPct}%`);
    this._setVal('cnt-metal', metalCnt);
    this._setVal('pct-wet', `${wetPct}%`);
    this._setVal('cnt-wet', wetCnt);
    this._setVal('pct-dry', `${dryPct}%`);
    this._setVal('cnt-dry', dryCnt);
  },

  _renderEventsTable(events) {
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    if (!events || events.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="padding:28px 16px; color:#64748b;">
            <div style="font-size:24px; margin-bottom:6px;">📡</div>
            <strong>No segregation events received yet.</strong><br>
            <span style="font-size:12px;">Power on the Arduino Uno prototype and transmit sensor readings to see live event logging.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = events.map(evt => {
      const meta = evt.metadata || {};
      const ts = this._formatDate(evt.timestamp);
      const eventId = `#EVT-${evt.id}`;
      const metalStr = meta.metal_detected
        ? '<span class="cat-badge cat-metal">🔩 Detected</span>'
        : '<span style="color:#64748b; font-size:12px;">Clear</span>';
      
      const moistVal = typeof meta.moisture_value === 'number'
        ? `${Number(meta.moisture_value).toFixed(1)}%`
        : (meta.moisture_detected ? 'Wet' : 'Dry');

      const moistStr = meta.moisture_detected || (meta.moisture_value && meta.moisture_value >= 45.0)
        ? `<span class="cat-badge cat-wet">🍃 ${moistVal}</span>`
        : `<span style="font-size:12px; color:#475569;">${moistVal}</span>`;

      const catBadge = this._catBadge(meta.predicted_category || 'Dry');
      const statusBadge = '<span class="status-badge status-online">Segregated</span>';

      return `
        <tr>
          <td style="white-space:nowrap; font-size:12px; color:#64748b;">${ts}</td>
          <td><code style="font-size:11.5px; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">${eventId}</code></td>
          <td>${metalStr}</td>
          <td>${moistStr}</td>
          <td>${catBadge}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  _catBadge(category) {
    const cat = (category || 'Dry').trim().toLowerCase();
    if (cat.includes('metal')) {
      return '<span class="cat-badge cat-metal">🔩 Metal</span>';
    } else if (cat.includes('wet')) {
      return '<span class="cat-badge cat-wet">🍃 Wet</span>';
    } else {
      return '<span class="cat-badge cat-dry">📦 Dry (Residual)</span>';
    }
  },

  _setOfflineState() {
    this._setVal('kpi-total-val', '0');
    this._setVal('kpi-metal-val', '0');
    this._setVal('kpi-wet-val', '0');
    this._setVal('kpi-dry-val', '0');
    const badgeWrap = document.getElementById('station-conn-badge');
    if (badgeWrap) badgeWrap.innerHTML = '<span class="status-badge status-offline">○ Offline</span>';
    const metalValEl = document.getElementById('metal-sensor-val');
    if (metalValEl) metalValEl.textContent = 'Offline / No data';
    const moistValEl = document.getElementById('moisture-sensor-val');
    if (moistValEl) moistValEl.textContent = 'Offline / No data';
  },

  _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  _formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
             ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  }
};
