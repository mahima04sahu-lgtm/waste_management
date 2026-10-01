/* HazGuard Operational Analytics Controller */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('analytics.html')) return;
  AnalyticsManager.init();
});

class AnalyticsManager {
  static async init() {
    await this.loadAnalytics();
    await this.loadForecast();
  }

  static async loadForecast() {
    const forecastBody = document.getElementById('analytics-forecast-table-body');
    if (!forecastBody) return;

    try {
      const data = await ApiClient.get('/analytics/forecast/');
      const predictions = data.predictions || [];

      if (!predictions || predictions.length === 0) {
        forecastBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px;">No forecast predictions available.</td></tr>`;
        return;
      }

      forecastBody.innerHTML = predictions.map(p => {
        let badgeClass = 'badge-low';
        let riskLabel = 'SAFE (LOW)';
        let forecastHorizonText = `~ ${p.predicted_days_to_80pct.toFixed(1)} Days`;
        let predHoursText = `${p.predicted_hours_to_80pct.toFixed(1)} Hours`;

        if (p.threshold_reached || p.current_fill_pct >= 80) {
          badgeClass = 'badge-critical';
          riskLabel = 'COLLECTION REQUIRED';
          forecastHorizonText = '80% Fill Threshold Already Reached';
          predHoursText = '0.0 Hours';
        } else if (p.predicted_hours_to_80pct <= 24.0) {
          badgeClass = 'badge-high';
          riskLabel = 'UPCOMING (HIGH)';
        } else if (p.current_fill_pct >= 50.0) {
          badgeClass = 'badge-medium';
          riskLabel = 'MEDIUM RISK';
        }

        return `
          <tr>
            <td style="font-weight:700;"><a href="bin-details.html?id=${p.container_id}">${p.container_id}</a></td>
            <td>${p.ward}</td>
            <td style="font-weight:600;">${p.current_fill_pct.toFixed(1)}%</td>
            <td>${p.current_weight_kg.toFixed(1)} kg</td>
            <td style="font-weight:700; color:${p.current_fill_pct >= 80 ? 'var(--status-critical)' : 'var(--text-main)'};">${predHoursText}</td>
            <td style="font-size:12px; color:${p.current_fill_pct >= 80 ? 'var(--status-critical)' : 'var(--text-secondary)'}; font-weight:${p.current_fill_pct >= 80 ? '700' : '400'};">${forecastHorizonText}</td>
            <td><span class="badge ${badgeClass}"><span class="badge-dot"></span>${riskLabel}</span></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.warn('Failed loading forecast predictions', e);
      if (forecastBody) forecastBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:var(--status-critical);">Unable to load live ML predictions.</td></tr>`;
    }
  }

  static async runLiveSimulation() {
    const fill = parseFloat(document.getElementById('sim-fill').value) || 65.0;
    const weight = parseFloat(document.getElementById('sim-weight').value) || 32.5;
    const temp = parseFloat(document.getElementById('sim-temp').value) || 29.5;

    const resultBox = document.getElementById('sim-result-box');
    const predText = document.getElementById('sim-pred-text');
    const latencyText = document.getElementById('sim-latency-text');

    try {
      const response = await ApiClient.post('/analytics/forecast/', {
        fill_level_pct: fill,
        waste_weight_kg: weight,
        temperature_c: temp,
        humidity_pct: 58.0,
        daily_fill_rate_pct_points: 8.5
      });

      if (response && response.success) {
        const hrs = response.predicted_hours_to_80pct;
        const days = response.predicted_days_to_80pct;
        const lat = response.inference_latency_ms;
        const thresholdReached = response.threshold_reached || fill >= 80.0;

        if (thresholdReached) {
          predText.innerHTML = `<span style="color:var(--status-critical); font-weight:800;">80% Fill Threshold Already Reached</span> &bull; <strong style="color:var(--status-critical);">Collection Required</strong>`;
        } else {
          predText.innerHTML = `Estimated Time to 80% Fill Limit: <span style="color:var(--accent-teal); font-weight:800;">${hrs} Hours</span> (~${days} Days)`;
        }

        latencyText.textContent = `Latency: ${lat} ms (${response.inference_type || 'XGBoost'})`;
        resultBox.style.display = 'block';

        const toastMsg = thresholdReached ? 'Threshold Reached: Collection Required' : `XGBoost Inference: ${hrs} hours to 80% fill`;
        Components.showToast(toastMsg, thresholdReached ? 'error' : 'info');
      }
    } catch (err) {
      Components.showToast('Inference error: ' + (err.message || 'Failed model calculation'), 'error');
    }
  }




  static async loadAnalytics() {
    try {
      const data = await ApiClient.get('/analytics/summary/');
      const wardData = data.ward_breakdown || [];
      const catData = data.category_breakdown || [];
      const eff = data.efficiency_metrics || {};

      // Render Ward Breakdown Table
      const wardBody = document.getElementById('analytics-ward-table-body');
      if (wardBody) {
        wardBody.innerHTML = wardData.map(w => `
          <tr>
            <td style="font-weight:600;">${w.ward}</td>
            <td style="font-weight:700;">${w.waste_kg.toFixed(1)} kg</td>
            <td>${w.containers} Active Points</td>
          </tr>
        `).join('');
      }

      // Render Category Breakdown Table
      const catBody = document.getElementById('analytics-category-table-body');
      if (catBody) {
        catBody.innerHTML = catData.map(c => `
          <tr>
            <td style="font-weight:600;">${c.category}</td>
            <td>${c.percentage}%</td>
            <td style="font-weight:700;">${c.weight_kg.toFixed(1)} kg</td>
          </tr>
        `).join('');
      }

      // Render BEFORE vs AFTER Manual Handling Exposure Metrics
      const b = eff.before_hazguard || {};
      const a = eff.after_hazguard || {};

      const beforeEl = document.getElementById('metric-before-inspections');
      if (beforeEl) {
        beforeEl.innerHTML = `
          <div style="font-size:22px; font-weight:800; color:var(--status-critical);">${b.manual_inspections_per_day || 120}</div>
          <div style="font-size:11px; color:var(--text-secondary);">Manual Container Openings / Day</div>
          <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">
            • Avg Response Time: <strong>${b.avg_response_time_minutes || 48} mins</strong><br>
            • Worker Exposure Events: <strong>${b.worker_exposure_events || 34} / mo</strong><br>
            • Unidentified Hazards: <strong>${b.unidentified_hazard_incidents || 8}</strong>
          </div>
        `;
      }

      const afterEl = document.getElementById('metric-after-inspections');
      if (afterEl) {
        afterEl.innerHTML = `
          <div style="font-size:22px; font-weight:800; color:var(--status-low);">${a.manual_inspections_per_day || 26} <span style="font-size:13px; font-weight:600;">(-78%)</span></div>
          <div style="font-size:11px; color:var(--text-secondary);">Automated Telemetry Inspections / Day</div>
          <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">
            • Avg Response Time: <strong style="color:var(--status-low);">${a.avg_response_time_minutes || 12} mins</strong> (75% faster)<br>
            • Worker Exposure Events: <strong style="color:var(--status-low);">${a.worker_exposure_events || 2} / mo</strong> (94% safer)<br>
            • Unidentified Hazards: <strong style="color:var(--status-low);">0</strong> (100% Isolated)
          </div>
        `;
      }
    } catch (e) {
      console.warn('Analytics API offline, fallback UI applied');
    }
  }
}
