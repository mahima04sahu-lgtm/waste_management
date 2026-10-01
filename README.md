# 🛡️ HazGuard: Intelligent Hospital Waste Handling & Worker Safety System

> **SIH 2026 Official Software Prototype**  
> A serious **hospital operations platform** designed to monitor biomedical waste containers, identify abnormal biohazard conditions, prioritize collection, reduce unnecessary manual exposure, and safely dispatch isolation and specialist handling protocols.

---

## 📋 Table of Contents
- [System Overview](#-system-overview)
- [Core Operational Paradigm](#-core-operational-paradigm)
- [User Roles & Permissions](#-user-roles--permissions)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Quick Start Guide](#-quick-start-guide)
- [REST API Endpoints](#-rest-api-endpoints)
- [IoT Hardware / ESP32 Ingestion API](#-iot-hardware--esp32-ingestion-api)
- [Demo Accounts](#-demo-accounts)
- [License](#-license)

---

## 🔬 System Overview

HazGuard is designed specifically for **hospital waste-management departments**, biomedical safety officers, facility managers, and healthcare operators. Unlike consumer IoT dustbin applications, HazGuard converts raw sensor telemetry and AI vision classifications into **prioritized operational decisions** backed by clinical rationale.

### Key Capabilities:
- **Real-Time Telemetry Processing**: Continuous tracking of fill level, weight, temperature, humidity, VOC gas indicators, and moisture.
- **AI Camera Vision Analysis**: Probabilistic classification of waste contents (`BIOHAZARD`, `SHARPS`, `HAZARD`, `NORMAL`, `UNKNOWN`).
- **Automated Risk Engine**: 0–100 normalized risk score calculation categorizing risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Priority Action Queue**: Automated dispatch recommendation (`ISOLATE`, `SPECIALIST REQUIRED`, `MECHANICALLY TRANSFER`, `INSPECT`, `HANDLE NOW`, `CLEAN / MAINTENANCE`).
- **Traceability Audit Log**: Full timeline recording of every operational event, risk escalation, and user action.
- **Safety Analytics**: Measured comparison showing a **78% reduction in manual handling exposure** for biomedical workers.

---

## ⚖️ Core Operational Paradigm

To enforce clinical safety standards, HazGuard strictly demarcates three data tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. SENSOR FACTS (Empirical Physical Telemetry)                               │
│    e.g., Temp = 31.2°C, VOC Gas = 420 ppm, Fill = 87%, Weight = 24.2 kg     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. AI VISION INFERENCES (Probabilistic Analysis)                             │
│    e.g., Classification = HAZARD, Confidence = 94%, Unknown Prob = 3%       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. OPERATIONAL DECISIONS (Recommended Handling Action)                       │
│    e.g., Action = ISOLATE, Reason = VOC Gas Spike + Liquid Hazard + AI Hazard│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 👥 User Roles & Permissions

| Role | Target Persona | Key Capabilities |
| :--- | :--- | :--- |
| **ADMIN** | Hospital System Administrator | User management, ward configuration, system threshold settings, full audit logs |
| **SUPERVISOR** | Biomedical Waste Supervisor | Ward point monitoring, collection approvals, worker safety tracking, analytics |
| **OPERATOR** | Biomedical Operations Staff | Container inspection, isolation confirmation, collection pickup completions |
| **SAFETY OFFICER** | Hospital Safety & Infection Control | High-risk container monitoring, incident response, specialist handling approvals |

---

## 💻 Technology Stack

### Frontend
- **Language**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **API Communication**: Native Fetch API
- **Design System**: Ergonomic, clinical visual hierarchy (Light surface, neutral gray backgrounds, subtle teal accents, status color coding)
- **Frameworks**: None (Pure modular JS & CSS)

### Backend
- **Core Framework**: Python 3.12+, Django 5.0
- **API Layer**: Django REST Framework (DRF)
- **Authentication**: Token Authentication & Django Session Auth
- **Database**: PostgreSQL (with automatic zero-config SQLite fallback for local development)
- **Static Assets**: WhiteNoise

---

## 📁 Project Directory Structure

```text
d:\react/
├── README.md                 # System documentation & setup guide
├── requirements.txt          # Complete Python dependencies
├── backend/
│   ├── manage.py             # Django management CLI entrypoint
│   ├── config/               # Project settings, URLs, WSGI/ASGI configuration
│   ├── users/                # User roles & employee profiles
│   ├── containers/           # Hospital waste container registry
│   ├── sensors/              # Sensor telemetry readings history
│   ├── vision/               # AI vision camera classification events
│   ├── risk/                 # Modular Risk Engine rule system & service
│   ├── actions/              # Priority Action Queue dispatcher
│   ├── alerts/               # Real-time alert matrix & status resolver
│   ├── collection/           # Collection records & tare weight logging
│   ├── analytics/            # Safety analytics & BEFORE vs AFTER metrics
│   ├── audit_logs/           # Full traceability timeline service
│   ├── devices/              # IoT ESP32 telemetry ingestion endpoint
│   └── demo/                 # Seed data management command (seed_demo_data)
└── frontend/
    ├── index.html            # Portal intro & landing page
    ├── login.html            # Clinical login page with demo role shortcuts
    ├── dashboard.html        # Main operations center (KPIs, Action Queue, Bins Table)
    ├── bins.html             # Container registry & filter matrix
    ├── bin-details.html      # Deep inspection (Fact vs Inference vs Decision)
    ├── actions.html          # Priority Action Queue manager
    ├── alerts.html           # Real-time alert resolution matrix
    ├── collection.html       # Waste pickup verification & tare weight logger
    ├── analytics.html        # Safety analytics (Exposure BEFORE vs AFTER)
    ├── settings.html         # Risk thresholds & ESP32 API documentation
    ├── css/
    │   ├── global.css        # Clinical color tokens, typography & badges
    │   ├── dashboard.css     # App header, sidebar & grid layouts
    │   ├── components.css    # Action cards, tier boxes, modals & toasts
    │   └── responsive.css    # Responsive workstation adaptivity
    └── js/
        ├── api.js            # Fetch client wrapper with auto host detection
        ├── auth.js           # Session manager & role permission guard
        ├── dashboard.js      # Dashboard controller & live auto-polling
        ├── bins.js           # Container table filter & search
        ├── bin-details.js    # 3-Tier inspection & sparkline graph rendering
        ├── actions.js        # Action queue confirm & complete handlers
        ├── alerts.js         # Alert acknowledge & resolve handlers
        ├── collection.js     # Dispatch queue manager
        ├── analytics.js      # Waste volume & exposure metric cards
        └── components.js     # Modals, toasts & status badges
```

---

## 🚀 Quick Start Guide

### 1. Clone or Open Project
Navigate to the root directory:
```bash
cd d:\react
```

### 2. Create & Activate Virtual Environment (`env`)

**Windows (PowerShell):**
```powershell
python -m venv env
.\env\Scripts\activate
```

**Linux / macOS:**
```bash
python3 -m venv env
source env/bin/activate
```

### 3. Install Required Libraries
```bash
pip install -r requirements.txt
```

### 4. Run Migrations & Seed Demo Data
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py seed_demo_data
```

### 5. Launch the Server
```bash
python manage.py runserver 0.0.0.0:8000
```

### 6. Access the System in Browser
Open your browser and navigate to:
👉 **[http://localhost:8000/login.html](http://localhost:8000/login.html)**

---

## 🔌 REST API Endpoints

| Resource | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login/` | User authentication & Token generation |
| **Auth** | `POST` | `/api/auth/logout/` | User session logout |
| **Auth** | `GET` | `/api/auth/me/` | Current authenticated user profile |
| **Containers** | `GET` | `/api/containers/` | Container list with ward/risk filters |
| **Containers** | `GET` | `/api/containers/<id>/` | Detailed container inspection payload |
| **Sensors** | `GET` | `/api/sensors/?container_id=H-014` | Sensor telemetry history |
| **Vision** | `GET` | `/api/vision/events/?container_id=H-014` | AI camera vision event logs |
| **Risk** | `GET` | `/api/risk/?container_id=H-014` | Risk score prediction records |
| **Actions** | `GET` | `/api/actions/` | Priority action queue items |
| **Actions** | `POST` | `/api/actions/<id>/confirm/` | Authorize and confirm action |
| **Actions** | `POST` | `/api/actions/<id>/complete/` | Complete operational action |
| **Alerts** | `GET` | `/api/alerts/` | System biohazard alerts matrix |
| **Alerts** | `POST` | `/api/alerts/<id>/acknowledge/` | Acknowledge active alert |
| **Alerts** | `POST` | `/api/alerts/<id>/resolve/` | Resolve alert |
| **Collection** | `GET` | `/api/collection/` | Collection dispatch queue |
| **Collection** | `POST` | `/api/collection/<id>/complete/` | Log pickup completion & weight |
| **Analytics** | `GET` | `/api/analytics/summary/` | Hospital metrics & exposure stats |
| **Audit Logs**| `GET` | `/api/audit-logs/` | System traceability audit timeline |
| **Devices** | `POST` | `/api/devices/sensor-data/` | IoT Telemetry Ingestion Endpoint |

---

## 📡 IoT Hardware / ESP32 Ingestion API

To connect physical ESP32 nodes or sensor simulators:

**Endpoint:** `POST http://localhost:8000/api/devices/sensor-data/`

**Sample Payload:**
```json
{
  "container_id": "H-014",
  "weight": 24.2,
  "fill_level": 87,
  "temperature": 31.2,
  "humidity": 68,
  "gas_indicator": 420,
  "moisture": 72,
  "device_status": "ONLINE"
}
```

**Response:**
```json
{
  "status": "success",
  "container_id": "H-014",
  "risk_assessment": {
    "score": 82,
    "level": "HIGH",
    "action": "ISOLATE",
    "reason": "Abnormal elevated VOC/gas indicator (>400 ppm) + High moisture / liquid hazard detected (72%) + High fill level (87%)"
  },
  "action_generated": 1,
  "alert_generated": 1
}
```

---

## 🔑 Demo Accounts

Use any of these demo accounts to test role-based capabilities:

| Role | Username | Password | Employee ID | Primary Ward |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `password123` | `EMP-001` | Administration |
| **Supervisor** | `supervisor` | `password123` | `EMP-002` | Biomedical Waste Dept |
| **Operator** | `raj_sharma` | `password123` | `EMP-003` | Emergency & ICU Wards |
| **Safety Officer** | `safety_officer` | `password123` | `EMP-004` | Hospital Safety Division |

*(You can also use the Quick Role Selector buttons directly on the login page at [http://localhost:8000/login.html](http://localhost:8000/login.html))*

---

## 📜 License
SIH 2026 Project Prototype — Built for Intelligent Hospital Waste Handling & Worker Safety System (HazGuard).
