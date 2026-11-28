# WasteGuard Hardware & Firmware Integration Guide

This directory contains everything required to connect your **physical Arduino Uno hardware** to the WasteGuard Dashboard.

---

## Hardware Architecture (Two-PC Setup)

```text
[ Physical Sensors ]
         │
         ▼
[   Arduino Uno   ]
         │ (USB Cable)
         ▼
┌──────────────────────────────────────────────┐
│  PC 1 (Arduino IDE Machine)                  │
│  1. Upload `wasteguard_uno.ino`              │
│  2. Run `python pc1_serial_bridge.py`        │
└──────────────────────┬───────────────────────┘
                       │ (Local Wi-Fi Network)
                       ▼
┌──────────────────────────────────────────────┐
│  PC 2 (Dashboard Server: 192.168.29.66)      │
│  • Django Server (0.0.0.0:8000)              │
│  • Web Dashboard displays live segregation   │
└──────────────────────────────────────────────┘
```

---

## 1. Physical Pin Wiring on Arduino Uno

| Component | Sensor Model | Arduino Pin | Trigger Logic | Output Action |
|:---|:---|:---|:---|:---|
| **Metal Sensor** | LJ12A3-4-Z/BX | **Digital Pin 2** | `Active HIGH` (5V on metal) | Priority 1: Routes to **Metal Bin** |
| **Object Proximity** | Optical / IR Beam | **Digital Pin 3** | `Active LOW` (Beam broken) | Begins sensor evaluation cycle |
| **Moisture Sensor** | Capacitive / Soil Probe | **Analog Pin A0** | Reading `≥ 45.0%` | Priority 2: Routes to **Wet Bin** |
| **Default Residual** | — | — | No metal AND moisture `< 45%` | Priority 3: Routes to **Dry Bin** |
| **Primary Servo** | SG90 / MG996R | **PWM Pin 5** | 45° (Metal) / 90° (Pass) | Diverts item into metal chute |
| **Secondary Servo**| SG90 / MG996R | **PWM Pin 6** | 135° (Wet) / 0° (Dry) | Diverts item into Wet or Dry bin |

---

## 2. Setup on PC 1 (Arduino PC)

1. Open **`wasteguard_uno.ino`** in the Arduino IDE on PC 1 and click **Upload** to flash the Arduino Uno.
2. In your terminal on PC 1, install the 2 small requirements:
   ```bash
   pip install pyserial requests
   ```
3. Run the bridge script:
   ```bash
   python pc1_serial_bridge.py
   ```
   *The script will auto-detect the Arduino COM port and start streaming sensor data to `http://192.168.29.66:8000/api/devices/sensor-data/`.*

---

## 3. Verifying on PC 2 (Dashboard Laptop)

Open your browser on this laptop:
* **Dashboard**: `http://localhost:8000/dashboard.html` — Watch the live sensor HUD and certainty score update in real-time.
* **Segregation History**: `http://localhost:8000/history.html` — Verify each logged segregation event.
* **Settings & Diagnostics**: `http://localhost:8000/settings.html` — Run manual ping and test packet transmissions.
