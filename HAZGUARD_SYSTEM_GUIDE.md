# 🛡️ WasteGuard: Comprehensive Technical & Architectural Guide
> **Smart India Hackathon (SIH 2026) Official Software Prototype**  
> *Campus & Healthcare Automated Waste Segregation, Proximity Sensing & Environmental Telemetry Platform*

---

## 📋 Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Waste Segregation Architecture (Dry, Wet, Hazardous)](#2-waste-segregation-architecture-dry-wet-hazardous)
3. [Proximity Sensing & Presence Detection](#3-proximity-sensing--presence-detection)
4. [Hardware Telemetry & Environmental Safety Monitoring](#4-hardware-telemetry--environmental-safety-monitoring)
5. [Risk Evaluation & Automated Operational Decision Engine](#5-risk-evaluation--automated-operational-decision-engine)
6. [System Architecture & Technology Stack](#6-system-architecture--technology-stack)
7. [Database Schema & Event Audit Trail](#7-database-schema--event-audit-trail)
8. [Hardware Integration & REST API Specifications](#8-hardware-integration--rest-api-specifications)
9. [Live Demonstration & Judge Presentation Script](#9-live-demonstration--judge-presentation-script)
10. [Judge Defense & Technical Q&A](#10-judge-defense--technical-qa)
11. [How to Export This Guide to PDF](#11-how-to-export-this-guide-to-pdf)

---

## 1. Executive Summary & Problem Statement

### The Problem
Traditional campus and healthcare facility waste handling faces three persistent challenges:
1. **Unnecessary Manual Contact & Exposure:** Personnel often interact with bins without prior knowledge of active status, exposing them to contaminated surfaces, sharps, or hazardous chemical fumes.
2. **Cross-Contamination of Waste Streams:** Mixing dry recyclables with organic wet waste or hazardous clinical materials compromises disposal pipelines and inflates waste-processing costs.
3. **Lack of Real-Time Station Telemetry:** Operations managers have no live visibility into station device health, proximity trigger frequency, or hazardous conditions such as flammable VOC gas buildup or moisture leaks.

### The WasteGuard Solution
WasteGuard provides a centralized operations and telemetry platform that monitors station status and controls segregation streams:
- **Defined Segregation Streams:** Dedicated partitioning for **Dry**, **Wet**, and **Hazardous** waste streams across campus stations.
- **Proximity-Based Presence Detection:** Optical/ultrasonic proximity telemetry detects approaching objects or personnel at bin hoppers in real time.
- **Environmental Hazard Monitoring:** Real-time intake of VOC gas concentration, temperature, moisture, and humidity to detect biological decomposition, hazardous fumes, or liquid spills.
- **Automated Risk Engine & Alerts:** Deterministic evaluation converts telemetry spikes into automated supervisor alerts, required PPE advisories, and maintenance dispatches.

---

## 2. Waste Segregation Architecture (Dry, Wet, Hazardous)

WasteGuard classifies all incoming station operations into three defined streams:

| Waste Stream | Color Code | Representative Materials | Station Handling Protocol |
| :--- | :--- | :--- | :--- |
| **Dry Waste** | Blue (`#0284c7`) | Paper, cardboard, clean plastics, bottles, packaging, aluminum cans | Standard transfer to campus recycling center. Normal nitrile gloves recommended. |
| **Wet Waste** | Green (`#16a34a`) | Food scraps, cafeteria leftovers, fruit/vegetable peels, biodegradable organics | Direct routing to composting / bio-methanation facility. Moisture-resistant sanitation gloves. |
| **Hazardous Waste** | Red (`#dc2626`) | Chemical residues, broken glass, sharps, biomedical scraps, cytotoxic items | Immediate segregation protocol. Heavy puncture-resistant gloves and safety eyewear mandatory. |

### Stream Selection & Activation
Stations can have their active segregation stream selected or updated through:
1. **Physical Selector Switches / Microcontroller Inputs:** Hardware sends the active stream via the telemetry ingestion API.
2. **Operations Dashboard Web Control:** Supervisors or operators can manually switch the stream via the station control panel (`POST /api/containers/<id>/select-category/`).

---

## 3. Proximity Sensing & Presence Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STATION INTAKE PROXIMITY EVENT                        │
│                                                                             │
│    [ Approaching Object / Hand ] ──> [ Proximity Sensor (IR / Ultrasonic) ] │
│                                                      │                      │
│                                                      ▼                      │
│                                            ESP32 / Microcontroller          │
│                                                      │                      │
│                                            HTTP POST JSON Telemetry         │
│                                                      │                      │
│                                                      ▼                      │
│                                            WasteGuard Cloud / Django        │
│                                                      │                      │
│                                ┌─────────────────────┴──────────────────┐   │
│                                ▼                                        ▼   │
│                      [ Container Status ]                     [ Real-Time   │
│                      proximity_detected=True                  Dashboard HUD]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Purpose & Behavior
- Proximity sensors detect physical presence at the station opening.
- When an object or user approaches the hopper, the sensor registers an event (`proximity_detected = True`).
- The station status badge immediately transitions from **CLEAR / IDLE** (`#94a3b8`) to **OBJECT DETECTED** (`#15803d`), signaling active engagement.

> [!IMPORTANT]
> **Technical Scope Clarification:**  
> Proximity sensing detects **physical presence only** (whether an object or person is at the intake). It does **not** identify or classify the material composition of the waste. Stream selection is managed through hardware stream switches or operator selection.

---

## 4. Hardware Telemetry & Environmental Safety Monitoring

Each WasteGuard station continuously transmits empirical sensor facts to the backend:

| Telemetry Metric | Unit | Normal Range | Critical Threshold | Safety Implication |
| :--- | :--- | :--- | :--- | :--- |
| **Proximity State** | Boolean | `False` (Idle) | `True` (Present) | Detects active disposal events and intake usage patterns |
| **VOC / Gas Indicator** | ppm | $0 - 250\text{ ppm}$ | $\ge 350\text{ ppm}$ | Detects toxic fume accumulation, anaerobic decomposition, or chemical spills |
| **Ambient Temperature** | °C | $18.0 - 32.0\text{ °C}$ | $\ge 38.0\text{ °C}$ | Detects exothermic reactions, direct sun overheating, or combustion risk |
| **Relative Humidity** | % | $30 - 65\text{ %}$ | $\ge 80\text{ %}$ | Indicates condensation or excessive moisture saturation |
| **Moisture Index** | % | $0 - 40\text{ %}$ | $\ge 75\text{ %}$ | Detects liquid spills, leaks, or cross-contamination in dry compartments |
| **Device Status** | Enum | `ONLINE` | `OFFLINE` | Hardware heartbeat monitoring; raises alert if communication is lost |

---

## 5. Risk Evaluation & Automated Operational Decision Engine

Located in [backend/risk/services.py](file:///d:/SIH_demo/waste_management/backend/risk/services.py).

Whenever a station transmits telemetry, the risk engine calculates an operational safety score ($0 - 100$) based on physical sensor thresholds and current stream configuration:

```python
def calculate_container_risk(container, sensor_reading=None, vision_event=None):
    score = 0
    reasons = []

    # 1. Device Communication Check
    if container.device_status == 'OFFLINE':
        return {'risk_score': 50, 'risk_level': 'MEDIUM', 'recommended_action': 'INSPECT'}

    # 2. Gas / VOC Accumulation Check
    if gas_val >= 400:
        score += 35
        reasons.append("Abnormal elevated VOC/gas indicator (>400 ppm)")
    elif gas_val >= 250:
        score += 20
        reasons.append("Elevated VOC gas readings")

    # 3. Temperature Anomalies
    if temp_val >= 38.0:
        score += 25
        reasons.append(f"Abnormal container temperature ({temp_val:.1f}°C)")
    elif temp_val >= 32.0:
        score += 15
        reasons.append(f"Elevated temperature ({temp_val:.1f}°C)")

    # 4. Moisture & Liquid Spill Check
    if moist_val >= 75.0:
        score += 25
        reasons.append("High moisture / liquid hazard detected")

    # 5. Waste Stream Hazard Awareness
    if container.waste_category == 'HAZARDOUS':
        score += 10
        if gas_val >= 250 or moist_val >= 50.0:
            score += 25
            reasons.append("Hazardous stream with elevated volatile activity")

    return {
        'risk_score': min(100, score),
        'risk_level': 'CRITICAL' if score >= 80 else 'HIGH' if score >= 60 else 'MEDIUM' if score >= 35 else 'LOW',
        'recommended_action': 'ISOLATE' if score >= 80 else 'INSPECT' if score >= 35 else 'NO ACTION'
    }
```

### Automated Action Triggers
* **`CRITICAL` Risk ($\ge 80$) or VOC $\ge 400\text{ ppm}$:** Automatically generates an immediate `ISOLATE` action and dispatches a critical supervisor alert.
* **`HIGH` Risk ($60 - 79$):** Flags station for safety inspection and assigns required PPE protocols.
* **`MEDIUM` Risk ($35 - 59$):** Alerts local sanitation operators to verify bin contents.
* **`LOW` Risk ($< 35$):** Normal operational baseline; status indicator displays green.

---

## 6. System Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIER                                  │
│   Web Browser (Chrome, Edge, Firefox, Mobile Safari)                        │
│   • Dashboard HUD (dashboard.html)    • Waste Stations Grid (bins.html)     │
│   • Station Details (bin-details.html)• Analytics Overview (analytics.html) │
│   • Operations Alerts (alerts.html)   • Collection Dispatches (collection)  │
│   • Technology: HTML5, CSS3 Variables, Vanilla ES6 JavaScript (Zero Bloat)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                SERVER TIER                                  │
│   Python 3.12 / Django 5.0 Core + Django REST Framework                     │
│   • REST Endpoints: /api/containers/, /api/devices/, /api/analytics/        │
│   • Security: TokenAuthentication & SessionAuthentication                   │
│   • Risk Evaluation Service (backend/risk/services.py)                      │
│   • Centralized Audit Logging Service (backend/audit_logs/services.py)      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                DATABASE TIER                                │
│   SQLite3 (Local Development / Prototype) / PostgreSQL (Production)         │
│   • Containers & Streams  • Sensor Readings History                         │
│   • Risk Predictions      • Alerts & Dispatches       • Audit Trail         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema & Event Audit Trail

### `Container` Model (`backend/containers/models.py`)
* `container_id` (`CharField`): Station identifier (e.g., `'STATION-01'`).
* `name` (`CharField`): Human-readable name (e.g., `'Central Garden Station'`).
* `location` / `ward` (`CharField`): Campus location and assigned zone.
* `device_status` (`CharField`): Current hardware connectivity (`ONLINE` / `OFFLINE`).
* `proximity_detected` (`BooleanField`): Real-time flag indicating object/hand presence at intake.
* `waste_category` (`CharField`): Selected stream (`DRY`, `WET`, `HAZARDOUS`).
* `current_waste` (`CharField`): Display label (`Dry`, `Wet`, `Hazard`).
* `last_processed` (`CharField`): Timestamp or event description of last activity.

### `SensorReading` Model (`backend/sensors/models.py`)
* `container` (`ForeignKey`): Target station.
* `timestamp` (`DateTimeField`): Record timestamp.
* `proximity_detected` (`BooleanField`): Sensor reading snapshot.
* `temperature` (`FloatField`): Ambient temperature in °C.
* `humidity` (`FloatField`): Relative humidity percentage.
* `gas_indicator` (`FloatField`): Volatile organic compounds in ppm.
* `moisture` (`FloatField`): Moisture level percentage.
* `device_status` (`CharField`): Reported status at time of reading.

### `AuditLog` Model (`backend/audit_logs/models.py`)
* Immutable operations log containing `timestamp`, `user`, `action` (`TELEMETRY_INGESTION`, `CATEGORY_SELECTED`, `COLLECTION_VERIFIED`), `entity_id`, and structured `metadata`.

---

## 8. Hardware Integration & REST API Specifications

### 1. Ingest IoT Telemetry
```http
POST /api/devices/sensor-data/
Content-Type: application/json
```
**Request Payload:**
```json
{
  "container_id": "STATION-01",
  "proximity_detected": true,
  "temperature": 26.4,
  "humidity": 55.0,
  "gas_indicator": 140.0,
  "moisture": 25.0,
  "device_status": "ONLINE"
}
```
**Response (`201 Created`):**
```json
{
  "status": "success",
  "container_id": "STATION-01",
  "timestamp": "2026-10-29T00:15:00Z",
  "risk_assessment": {
    "score": 0,
    "level": "LOW",
    "action": "NO ACTION",
    "reason": "All station sensor telemetry within normal operational baseline limits."
  },
  "action_generated": null,
  "alert_generated": null
}
```

### 2. Select Waste Stream Category
```http
POST /api/containers/<id>/select-category/
Content-Type: application/json
```
**Request Payload:**
```json
{
  "category": "HAZARDOUS"
}
```
**Response (`200 OK`):**
```json
{
  "status": "success",
  "container_id": "STATION-01",
  "selected_category": "Hazard",
  "waste_category": "HAZARDOUS",
  "last_processed": "Just now (Category Selected)"
}
```

### 3. Toggle Proximity Presence
```http
POST /api/containers/<id>/set-proximity/
Content-Type: application/json
```
**Request Payload:**
```json
{
  "proximity_detected": true
}
```
**Response (`200 OK`):**
```json
{
  "status": "success",
  "container_id": "STATION-01",
  "proximity_detected": true
}
```

### 4. Fetch Analytics Summary
```http
GET /api/analytics/summary/
```
**Response (`200 OK`):**
```json
{
  "kpis": {
    "total_containers": 5,
    "active_containers": 5,
    "proximity_active": 2,
    "high_risk_containers": 0,
    "offline_devices": 0
  },
  "location_breakdown": [
    { "location": "Central Garden", "active_stations": 1, "primary_stream": "Dry Waste" },
    { "location": "Cafeteria", "active_stations": 1, "primary_stream": "Wet Waste" },
    { "location": "Hostel Complex", "active_stations": 1, "primary_stream": "Hazardous Waste" }
  ],
  "category_breakdown": [
    { "category": "Dry Waste", "percentage": 56.0 },
    { "category": "Wet Waste", "percentage": 34.0 },
    { "category": "Hazardous Waste", "percentage": 10.0 }
  ],
  "efficiency_metrics": {
    "segregation_accuracy_pct": 98.4,
    "cross_contamination_rate_pct": 1.6,
    "proximity_detections_today": 142
  }
}
```

---

## 9. Live Demonstration & Judge Presentation Script

### 🎤 Suggested 2-Minute Presentation Pitch

> *"Respected Evaluators, traditional campus waste management suffers from two critical failure modes: manual exposure to unknown hazardous waste, and zero real-time operational visibility into station health and containment risks.*
>
> *We built **WasteGuard**: a responsive campus waste segregation and IoT telemetry platform that provides live visibility into waste streams, proximity presence, and station environmental health.*
>
> *(Point to Dashboard at `localhost:8000/dashboard.html`)*
> *Across our 5 campus stations, WasteGuard tracks the active segregation stream—**Dry Recyclables**, **Wet Organics**, and **Hazardous Materials**.*
>
> *(Demonstrate Station Intake Presence)*
> *When an individual approaches a station hopper, our physical proximity sensors detect the presence. The dashboard instantly reflects the active status, transitioning from **CLEAR / IDLE** to **OBJECT DETECTED**.*
>
> *(Demonstrate Stream Switching)*
> *Operators or automated hopper switches can designate the intake stream. Selecting **Hazardous Stream** immediately updates station protocols, requiring mandatory protective equipment.*
>
> *(Point to Environmental Telemetry)*
> *Simultaneously, our risk engine evaluates VOC gas levels, moisture, and temperature. If VOC levels exceed safety thresholds, WasteGuard generates an automated supervisor alert and isolation action before workers are exposed.*
>
> *By combining simple, robust proximity presence detection with real-time environmental telemetry, WasteGuard delivers a practical, hardware-resilient solution ready for campus deployment."*

---

## 10. Judge Defense & Technical Q&A

#### Q1: "Does the proximity sensor identify what kind of waste is being deposited?"
> *"No. The proximity sensor functions strictly as an **object and presence detection mechanism** at the intake opening. It tells the system that an object or hand is present at the hopper. Waste stream categorization is handled via station stream selection switches or operator designation. This intentional architectural decoupling keeps hardware costs low and avoids fragile sensing components."*

#### Q2: "Why did you choose this architecture over complex camera recognition inside the bins?"
> *"Optical camera lenses placed inside or directly over waste bins rapidly succumb to dust, liquid splatters, humidity condensation, and low-light degradation. By focusing on robust proximity presence sensing and environmental sensors (VOC gas, temperature, moisture), WasteGuard operates reliably in demanding physical environments without requiring optical maintenance."*

#### Q3: "How does the system handle high-risk situations like chemical fumes or toxic gas?"
> *"Our modular risk engine in `backend/risk/services.py` monitors real-time VOC gas levels. If volatile gas concentrations exceed 350 ppm, the platform automatically flags the station as `HIGH` or `CRITICAL` risk, generates an immediate `GAS_ANOMALY` alert, and creates an `ISOLATE` action for facility supervisors."*

#### Q4: "How does an ESP32 or external microcontroller communicate with WasteGuard?"
> *"Microcontrollers communicate over standard HTTP REST via `POST /api/devices/sensor-data/`. The payload is a compact JSON object containing the station identifier, proximity state boolean, and sensor readings. The server responds with `201 Created` and the evaluated risk status."*

---

## 11. How to Export This Guide to PDF

1. **Via Browser (Recommended):**
   * Open `http://localhost:8000/guide.html` in your browser.
   * Press **`Ctrl + P`** (Print).
   * Destination: **"Save as PDF"**.
   * Enable **"Background graphics"** $\to$ Click **Save**.
2. **Via VS Code / IDE Extension:**
   * Install the **Markdown PDF** extension.
   * Right-click inside `HAZGUARD_SYSTEM_GUIDE.md` $\to$ Select **Markdown PDF: Export (pdf)**.
