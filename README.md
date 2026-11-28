# ♻️ WasteGuard: Automated Waste Segregation Prototype (Metal / Wet / Dry)

> **SIH 2026 Prototype System**  
> A single-station, Arduino Uno-based, rule-based automated waste segregation prototype that accurately categorizes waste into **Metal**, **Wet**, and **Dry** streams using physical inductive and moisture sensors.

---

## 📋 Table of Contents
- [System Overview](#-system-overview)
- [Rule-Based Segregation Logic](#-rule-based-segregation-logic)
- [Hardware Architecture](#-hardware-architecture)
- [User Roles & Permissions](#-user-roles--permissions)
- [Technology Stack](#-technology-stack)
- [Dashboard & Web Interface](#-dashboard--web-interface)
- [REST API Endpoints](#-rest-api-endpoints)
- [Arduino / Hardware Ingestion API](#-arduino--hardware-ingestion-api)
- [Quick Start Guide](#-quick-start-guide)
- [Demo Accounts](#-demo-accounts)

---

## 🔬 System Overview

WasteGuard is designed for automated, physical segregation at the point of disposal. The system focuses on a **single physical station** (`STATION-01`) equipped with confirmed sensor hardware:
1. **Inductive Metal Sensor**: Detects metallic / ferrous objects.
2. **Moisture / Conductivity Sensor**: Measures moisture level for wet waste detection.

### Categorization Output:
- 🔩 **Metal**: Metallic / ferrous waste (cans, foil, bottle caps).
- 🍃 **Wet**: Organic / moisture-rich waste (food waste, fruit peels, liquid residuals).
- 📦 **Dry**: Residual non-metallic dry waste (paper, dry packaging, cardboard, plastic).

---

## ⚖️ Rule-Based Segregation Logic

The system follows strict, deterministic physical rules:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. METAL CHECK (Priority 1)                                                 │
│    Is inductive metal sensor triggered?                                     │
│    ──► YES: Route to METAL compartment                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. MOISTURE CHECK (Priority 2)                                              │
│    Is moisture reading ≥ 45.0% or wetness detected?                         │
│    ──► YES: Route to WET compartment                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. RESIDUAL DRY WASTE (Priority 3)                                          │
│    Neither metal nor moisture detected.                                     │
│    ──► Route to DRY compartment (residual)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Hardware Architecture

- **Microcontroller**: Arduino Uno / ESP32
- **Sensors**:
  - Inductive Proximity / Metal Sensor (Digital Input)
  - Analog Soil / Soil Moisture Sensor (Analog Input, 0–100%)
- **Communication**: HTTP POST to `/api/devices/sensor-data/`
- **Station ID**: `STATION-01`

---

## 👥 User Roles & Permissions

| Role | Target Persona | Key Capabilities |
| :--- | :--- | :--- |
| **ADMIN** | System Administrator | Sensor calibration, threshold configuration, audit logs |
| **SUPERVISOR** | Operations Supervisor | Station monitoring, event verification, reports |
| **OPERATOR** | Field Operator | Physical inspection, hardware maintenance, pickup |
| **VERIFICATION** | Verification Analyst | Ground-truth verification trials, accuracy audit |

---

## 💻 Technology Stack

- **Backend**: Python 3.14, Django 6.0, Django REST Framework
- **Database**: SQLite 3 (`db.sqlite3`)
- **Frontend**: Clean Vanilla JavaScript (ES6+), Modern Responsive CSS, HTML5
- **Visual Identity**: Clean WasteGuard green-and-white theme
- **Authentication**: Token-based / Session authentication

---

## 🖥️ Dashboard & Web Interface

1. **Dashboard** (`/dashboard.html`): Real-time station HUD for `STATION-01`, live sensor telemetry, 4 KPI cards (Total, Metal, Wet, Dry), stream distribution bar, recent segregation events.
2. **Segregation History** (`/history.html`): Readable event history table with timestamp, event ID, station, metal reading, moisture reading, predicted category, status, and JSON payload viewer modal.
3. **Test Verification** (`/reviews.html`): Ground-truth verification tool for logging physical test trials against rule predictions, calculating verified accuracy.
4. **Reports** (`/analytics.html`): Distribution breakdown and segregation statistics based on actual database records.
5. **Settings** (`/settings.html`): Sensor calibration thresholds, Arduino Uno payload specs, and connection diagnostics.

---

## 🌐 REST API Endpoints

| Resource | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Hardware Ingest** | `POST` | `/api/devices/sensor-data/` | Ingest sensor data from Arduino / ESP32 |
| **Station Ping** | `GET` | `/api/devices/ping/` | Check station connection status |
| **Station Config** | `GET` | `/api/devices/config/` | Retrieve active calibration thresholds |
| **Audit Logs** | `GET` | `/api/audit-logs/` | Query segregation event history |
| **Station Details** | `GET` | `/api/containers/` | Station status and compartment levels |
| **Select Stream** | `POST` | `/api/containers/<id>/select-category/` | Select stream (METAL, WET, DRY) |
| **Analytics** | `GET` | `/api/analytics/summary/` | Event counts and category distribution |

---

## 📡 Arduino / Hardware Ingestion API

### Endpoint:
```http
POST /api/devices/sensor-data/
Content-Type: application/json
```

### Ingestion Payload:
```json
{
  "container_id": "STATION-01",
  "metal_detected": true,
  "moisture": 14.5,
  "device_status": "ONLINE"
}
```

### Ingestion Response:
```json
{
  "status": "success",
  "container_id": "STATION-01",
  "predicted_category": "Metal",
  "rule_applied": "Metal sensor detected inductive material",
  "sensor_reading": {
    "metal_detected": true,
    "moisture": 14.5,
    "device_status": "ONLINE"
  }
}
```

---

## 🚀 Quick Start Guide

### 1. Start Django Server
```powershell
Set-Location -Path "d:\SIH_demo\waste_management\backend"
..\env\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

### 2. Access the Dashboard
Open your browser at:
`http://127.0.0.1:8000/dashboard.html`

---

## 🔐 Demo Accounts

| Role | Username | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `password123` |
| **Supervisor** | `supervisor` | `password123` |
| **Operator** | `raj_sharma` | `password123` |
| **Verification** | `safety_officer` | `password123` |
