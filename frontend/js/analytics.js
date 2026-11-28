/* WasteGuard Operational Analytics Controller - Segregation & Telemetry */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('analytics.html')) return;
  AnalyticsManager.init();
});

class AnalyticsManager {
  static async init() {
    await this.loadAnalytics();
  }

  static async loadAnalytics() {
    try {
      const data = await ApiClient.get('/analytics/summary/');
      const locationData = data.location_breakdown || [];
      const catData = data.category_breakdown || [];
      const eff = data.efficiency_metrics || {};

      // Render Category Breakdown Table
      const catBody = document.getElementById('analytics-category-table-body');
      if (catBody) {
        catBody.innerHTML = catData.map(c => `
          <tr>
            <td style="font-weight:700;">${c.category}</td>
            <td style="font-weight:600;">${c.percentage}%</td>
            <td><span class="badge badge-low">${c.status || 'Active'}</span></td>
          </tr>
        `).join('');
      }

      // Render Location Breakdown Table
      const locBody = document.getElementById('analytics-ward-table-body');
      if (locBody) {
        locBody.innerHTML = locationData.map(loc => `
          <tr>
            <td style="font-weight:600;">📍 ${loc.location}</td>
            <td style="font-weight:700;">${loc.active_stations} Active Station</td>
            <td><strong>${loc.primary_stream}</strong></td>
          </tr>
        `).join('');
      }

      // Render Segregation Performance Metrics
      const beforeEl = document.getElementById('metric-before-inspections');
      if (beforeEl) {
        beforeEl.innerHTML = `
          <div style="font-size:20px; font-weight:800; color:var(--status-critical);">High Residual Waste</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Traditional Unsorted Campus Bins</div>
          <div style="margin-top:10px; font-size:12.5px; color:var(--text-secondary); line-height:1.5;">
            &bull; Unsorted mixed waste sent directly to landfill<br>
            &bull; Zero presence detection or category verification<br>
            &bull; Frequent overflow &amp; uncontrolled disposal
          </div>
        `;
      }

      const afterEl = document.getElementById('metric-after-inspections');
      if (afterEl) {
        afterEl.innerHTML = `
          <div style="font-size:20px; font-weight:800; color:var(--status-low);">${eff.segregation_accuracy_pct || 98.4}% Accuracy</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">WasteGuard Automated Segregation Stations</div>
          <div style="margin-top:10px; font-size:12.5px; color:var(--text-secondary); line-height:1.5;">
            &bull; Proximity detection with <strong>${eff.proximity_detections_today || 142}</strong> verified object events<br>
            &bull; 3-Stream physical segregation (Metal, Wet, Dry)<br>
            &bull; Cross-contamination rate kept under <strong>${eff.cross_contamination_rate_pct || 1.6}%</strong>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Analytics API offline, fallback UI applied', e);
    }
  }
}
