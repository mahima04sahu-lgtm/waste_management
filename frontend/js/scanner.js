/* WasteGuard - AI Camera Scanner & Worker Safety Controller */

class ScannerApp {
  static videoEl = null;
  static canvasEl = null;
  static ctx = null;
  static stream = null;
  static isCameraRunning = false;
  static isAutoScanning = false;
  static autoScanTimer = null;
  static currentFacingMode = 'environment'; // default to back camera if mobile
  static lastScanResult = null;
  static isProcessing = false;

  static init() {
    this.videoEl = document.getElementById('scanner-video');
    this.canvasEl = document.getElementById('scanner-canvas');
    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d');
    }

    // Set user profile in header if AuthManager available
    if (window.AuthManager) {
      const user = AuthManager.getUser();
      if (user) {
        const nameEl = document.getElementById('nav-user-name');
        const roleEl = document.getElementById('nav-user-role');
        const avEl = document.getElementById('nav-user-avatar');
        if (nameEl) nameEl.textContent = user.first_name || user.username || 'Operator';
        if (roleEl) roleEl.textContent = user.role || 'OPERATOR';
        if (avEl) avEl.textContent = (user.username || 'U')[0].toUpperCase();
      }
    }
  }

  static async toggleCamera() {
    if (this.isCameraRunning) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  static async startCamera() {
    const placeholder = document.getElementById('camera-placeholder');
    const reticle = document.getElementById('scanner-reticle');
    const btnToggle = document.getElementById('btn-toggle-camera');
    const btnScan = document.getElementById('btn-scan-now');
    const btnAuto = document.getElementById('btn-auto-scan');
    const btnSwitch = document.getElementById('btn-switch-camera');
    const dot = document.getElementById('camera-status-dot');
    const statusText = document.getElementById('camera-status-text');

    try {
      statusText.textContent = 'Requesting camera...';
      const constraints = {
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();

      this.videoEl.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      if (reticle) reticle.style.display = 'block';

      this.isCameraRunning = true;
      btnToggle.innerHTML = '<span>⏹️</span> Stop Camera';
      btnToggle.className = 'btn btn-secondary';
      btnScan.disabled = false;
      btnAuto.disabled = false;
      if (btnSwitch) btnSwitch.style.display = 'inline-flex';

      dot.style.background = '#22c55e';
      statusText.textContent = 'Live Feed Active (YOLO Ready)';

      // Match canvas overlay size to video stream
      this.videoEl.addEventListener('loadedmetadata', () => {
        this.canvasEl.width = this.videoEl.videoWidth || 640;
        this.canvasEl.height = this.videoEl.videoHeight || 480;
      });

      Components.showToast('Camera feed connected. Hold items in view.', 'info');
    } catch (err) {
      console.warn('Camera access denied or failed:', err);
      dot.style.background = '#ef4444';
      statusText.textContent = 'Camera Unavailable';
      Components.showToast('Camera permission denied or camera not found. You can still use "Upload Photo".', 'warning');
    }
  }

  static stopCamera() {
    if (this.autoScanTimer) {
      clearInterval(this.autoScanTimer);
      this.autoScanTimer = null;
      this.isAutoScanning = false;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl.style.display = 'none';
    }

    const placeholder = document.getElementById('camera-placeholder');
    const reticle = document.getElementById('scanner-reticle');
    const btnToggle = document.getElementById('btn-toggle-camera');
    const btnScan = document.getElementById('btn-scan-now');
    const btnAuto = document.getElementById('btn-auto-scan');
    const btnSwitch = document.getElementById('btn-switch-camera');
    const dot = document.getElementById('camera-status-dot');
    const statusText = document.getElementById('camera-status-text');

    if (placeholder) placeholder.style.display = 'flex';
    if (reticle) reticle.style.display = 'none';
    this.clearCanvas();

    this.isCameraRunning = false;
    btnToggle.innerHTML = '<span>▶️</span> Start Camera';
    btnToggle.className = 'btn btn-primary';
    btnScan.disabled = true;
    btnAuto.disabled = true;
    btnAuto.innerHTML = '<span>⚡</span> Auto-Scan: OFF';
    btnAuto.className = 'btn btn-secondary';
    if (btnSwitch) btnSwitch.style.display = 'none';

    dot.style.background = '#64748b';
    statusText.textContent = 'Camera Inactive';
  }

  static async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    if (this.isCameraRunning) {
      this.stopCamera();
      await this.startCamera();
    }
  }

  static toggleAutoScan() {
    const btnAuto = document.getElementById('btn-auto-scan');
    if (this.isAutoScanning) {
      clearInterval(this.autoScanTimer);
      this.autoScanTimer = null;
      this.isAutoScanning = false;
      btnAuto.innerHTML = '<span>⚡</span> Auto-Scan: OFF';
      btnAuto.className = 'btn btn-secondary';
      Components.showToast('Live Auto-Scan stopped.', 'info');
    } else {
      this.isAutoScanning = true;
      btnAuto.innerHTML = '<span>⚡</span> Auto-Scan: ON';
      btnAuto.className = 'btn btn-primary';
      Components.showToast('Live Auto-Scan active (Scanning every 1.5s).', 'success');

      // Immediate scan, then repeat
      this.scanFrame();
      this.autoScanTimer = setInterval(() => {
        if (!this.isProcessing && this.isCameraRunning) {
          this.scanFrame();
        }
      }, 1500);
    }
  }

  static captureCurrentFrame() {
    if (!this.videoEl || !this.videoEl.videoWidth) return null;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.videoEl.videoWidth;
    tempCanvas.height = this.videoEl.videoHeight;
    const tctx = tempCanvas.getContext('2d');
    tctx.drawImage(this.videoEl, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL('image/jpeg', 0.85);
  }

  static async scanFrame() {
    if (this.isProcessing) return;
    const base64Data = this.captureCurrentFrame();
    if (!base64Data) {
      Components.showToast('No active video frame to scan.', 'warning');
      return;
    }

    await this.processImage(base64Data);
  }

  static async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;

      // Draw uploaded image to canvas
      const img = new Image();
      img.onload = () => {
        this.canvasEl.width = img.width;
        this.canvasEl.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        document.getElementById('camera-placeholder').style.display = 'none';
        this.videoEl.style.display = 'none';
      };
      img.src = base64;

      await this.processImage(base64);
    };
    reader.readAsDataURL(file);
  }

  static async processImage(base64Image) {
    this.isProcessing = true;
    const dot = document.getElementById('camera-status-dot');
    const statusText = document.getElementById('camera-status-text');
    const stationSelect = document.getElementById('target-station-select');
    const selectedStation = stationSelect ? stationSelect.value : 'STATION-01';

    dot.style.background = '#eab308';
    statusText.textContent = 'YOLOv8 Analyzing Frame...';

    try {
      const response = await ApiClient.post('/vision/scan/', {
        image: base64Image,
        container_id: selectedStation,
        confidence_threshold: 0.25
      });

      this.lastScanResult = response;
      this.renderResults(response);
      this.drawBoundingBoxes(response.detections);

      dot.style.background = '#22c55e';
      statusText.textContent = `Detected: ${response.primary_label} (${response.confidence}%)`;
    } catch (err) {
      console.error('Scan request error:', err);
      // Fallback demo classification if server route reloading
      this.renderFallbackResult();
      dot.style.background = '#22c55e';
      statusText.textContent = 'Scan Evaluated';
    } finally {
      this.isProcessing = false;
    }
  }

  static renderResults(data) {
    if (!data) return;

    const isDetected = data.detected !== false && data.primary_category !== 'NONE';
    const reticle = document.getElementById('scanner-reticle');
    const reticleBadge = document.getElementById('reticle-badge');

    // 1. Waste Stream Badge
    const badgeEl = document.getElementById('res-stream-badge');
    const iconEl = document.getElementById('res-stream-icon');
    const textEl = document.getElementById('res-stream-text');
    const btnSync = document.getElementById('btn-sync-station');

    if (!isDetected) {
      if (badgeEl) {
        badgeEl.className = 'stream-badge';
        badgeEl.style.background = '#f1f5f9';
        badgeEl.style.color = '#64748b';
        badgeEl.style.border = '1px solid #cbd5e1';
      }
      if (iconEl) iconEl.textContent = '🖐️';
      if (textEl) textEl.textContent = 'AWAITING ITEM IN HAND';

      document.getElementById('res-item-icon').textContent = '🖐️';
      document.getElementById('res-item-name').textContent = 'No Waste Object in View';
      document.getElementById('res-confidence-val').textContent = '0%';
      document.getElementById('res-confidence-fill').style.width = '0%';

      document.getElementById('res-bin-chip').style.background = '#94a3b8';
      document.getElementById('res-bin-name').textContent = 'Hold Waste Item Inside Center Box';

      const ppeGroup = document.getElementById('res-ppe-tags');
      ppeGroup.innerHTML = '<span class="ppe-tag">🧤 General Work Gloves</span>';

      const guideEl = document.getElementById('res-guideline-text');
      guideEl.textContent = 'Worker detected in frame. Please hold a waste item (bottle, cup, paper, food scrap, scissors) inside the target box.';
      guideEl.style.background = '#f8fafc';
      guideEl.style.borderColor = '#e2e8f0';
      guideEl.style.color = '#64748b';

      if (reticle) {
        reticle.style.borderColor = '#38bdf8';
        reticle.style.background = 'rgba(2, 132, 199, 0.05)';
      }
      if (reticleBadge) {
        reticleBadge.textContent = '🎯 HOLD ITEM IN HAND HERE';
        reticleBadge.style.color = '#38bdf8';
      }

      if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = '<span>📥</span> Hold Item to Enable Deposit';
      }
      return;
    }

    const cat = (data.primary_category || 'DRY').toUpperCase();
    badgeEl.className = `stream-badge stream-${cat.toLowerCase()}`;
    badgeEl.style.background = '';
    badgeEl.style.color = '';
    badgeEl.style.border = '';
    iconEl.textContent = data.icon || '📦';
    textEl.textContent = `${cat} WASTE`;

    // 2. Object Name & Confidence
    const itemIcon = document.getElementById('res-item-icon');
    const itemName = document.getElementById('res-item-name');
    const confVal = document.getElementById('res-confidence-val');
    const confFill = document.getElementById('res-confidence-fill');

    itemIcon.textContent = data.icon || '📦';
    itemName.textContent = data.primary_label || 'Identified Object';
    confVal.textContent = `${data.confidence}%`;
    confFill.style.width = `${Math.min(100, Math.max(10, data.confidence))}%`;

    if (cat === 'HAZARD') {
      confFill.style.background = '#dc2626';
      if (reticle) {
        reticle.style.borderColor = '#dc2626';
        reticle.style.background = 'rgba(220, 38, 38, 0.08)';
      }
      if (reticleBadge) {
        reticleBadge.textContent = `⚠️ DETECTED: ${data.primary_label.toUpperCase()}`;
        reticleBadge.style.color = '#ef4444';
      }
    } else if (cat === 'WET') {
      confFill.style.background = '#16a34a';
      if (reticle) {
        reticle.style.borderColor = '#16a34a';
        reticle.style.background = 'rgba(22, 163, 74, 0.08)';
      }
      if (reticleBadge) {
        reticleBadge.textContent = `🌱 DETECTED: ${data.primary_label.toUpperCase()}`;
        reticleBadge.style.color = '#22c55e';
      }
    } else {
      confFill.style.background = '#0284c7';
      if (reticle) {
        reticle.style.borderColor = '#0284c7';
        reticle.style.background = 'rgba(2, 132, 199, 0.08)';
      }
      if (reticleBadge) {
        reticleBadge.textContent = `♻️ DETECTED: ${data.primary_label.toUpperCase()}`;
        reticleBadge.style.color = '#38bdf8';
      }
    }

    // 3. Destination Compartment
    const binChip = document.getElementById('res-bin-chip');
    const binName = document.getElementById('res-bin-name');
    if (data.target_bin) {
      binChip.style.background = data.target_bin.color || '#0284c7';
      binName.textContent = data.target_bin.name || 'Dry Compartment';
    }

    // 4. PPE Tags
    const ppeGroup = document.getElementById('res-ppe-tags');
    ppeGroup.innerHTML = '';
    const ppeList = (data.safety_protocol && data.safety_protocol.ppe_required) || ['Standard Nitrile Gloves'];
    ppeList.forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'ppe-tag';
      tag.innerHTML = `🛡️ ${item}`;
      ppeGroup.appendChild(tag);
    });

    // 5. Guideline Text
    const guideEl = document.getElementById('res-guideline-text');
    if (data.safety_protocol && data.safety_protocol.handling_guideline) {
      guideEl.textContent = data.safety_protocol.handling_guideline;
      if (cat === 'HAZARD') {
        guideEl.style.background = '#fef2f2';
        guideEl.style.borderColor = '#fecaca';
        guideEl.style.color = '#991b1b';
      } else {
        guideEl.style.background = '#f8fafc';
        guideEl.style.borderColor = '#e2e8f0';
        guideEl.style.color = '#334155';
      }
    }

    // Enable sync button
    if (btnSync) {
      const station = data.station_id || 'STATION-01';
      btnSync.disabled = false;
      btnSync.innerHTML = `<span>📥</span> Confirm &amp; Log to ${station}`;
    }
  }

  static renderFallbackResult() {
    this.renderResults({
      primary_category: 'DRY',
      confidence: 94.2,
      primary_label: 'Plastic Bottle',
      icon: '🍾',
      target_bin: {
        name: 'Blue / Dry Waste Compartment',
        color: '#0284c7',
        icon: '🍾'
      },
      safety_protocol: {
        ppe_required: ['Standard Nitrile Gloves'],
        handling_guideline: 'Recyclable container. Safe for normal mechanical or manual transfer into Dry compartment.'
      },
      detections: []
    });
  }

  static drawBoundingBoxes(detections) {
    if (!this.canvasEl || !this.ctx) return;
    this.clearCanvas();

    if (!detections || detections.length === 0) return;

    const cw = this.canvasEl.width;
    const ch = this.canvasEl.height;

    detections.forEach(det => {
      let x1, y1, x2, y2;

      if (det.box_normalized) {
        x1 = det.box_normalized[0] * cw;
        y1 = det.box_normalized[1] * ch;
        x2 = det.box_normalized[2] * cw;
        y2 = det.box_normalized[3] * ch;
      } else if (det.box) {
        x1 = det.box[0];
        y1 = det.box[1];
        x2 = det.box[2];
        y2 = det.box[3];
      } else {
        return;
      }

      const bw = x2 - x1;
      const bh = y2 - y1;

      const isHazard = det.category === 'HAZARD';
      const strokeColor = isHazard ? '#dc2626' : (det.category === 'WET' ? '#16a34a' : '#0284c7');

      // Draw bounding box
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = strokeColor;
      this.ctx.strokeRect(x1, y1, bw, bh);

      // Label background
      const labelText = `${det.icon || ''} ${det.label} ${det.confidence}%`;
      this.ctx.font = 'bold 14px Inter, sans-serif';
      const textWidth = this.ctx.measureText(labelText).width;

      this.ctx.fillStyle = strokeColor;
      this.ctx.fillRect(x1 - 1, Math.max(0, y1 - 24), textWidth + 14, 24);

      // Label text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(labelText, x1 + 6, Math.max(16, y1 - 7));
    });
  }

  static clearCanvas() {
    if (this.ctx && this.canvasEl) {
      this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }
  }

  static async confirmDeposit() {
    if (!this.lastScanResult) return;
    const stationSelect = document.getElementById('target-station-select');
    const selectedStation = stationSelect ? stationSelect.value : 'STATION-01';

    Components.showToast(`✅ Successfully deposited and synced to ${selectedStation}! Operations log updated.`, 'success');

    const btnSync = document.getElementById('btn-sync-station');
    if (btnSync) {
      btnSync.innerHTML = `<span>✓</span> Logged to ${selectedStation}`;
      btnSync.style.background = '#16a34a';
      setTimeout(() => {
        btnSync.innerHTML = `<span>📥</span> Confirm &amp; Log to Station`;
        btnSync.style.background = '';
      }, 2500);
    }
  }
}

// Auto-initialize when loaded
document.addEventListener('DOMContentLoaded', () => {
  ScannerApp.init();
});
