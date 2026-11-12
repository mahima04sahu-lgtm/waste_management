# 🔌 WasteGuard ESP32 Wi-Fi Hardware Integration Guide

This guide details the complete hardware connection, pin mapping, and setup process for connecting an **ESP32 microcontroller over Wi-Fi** to the WasteGuard backend.

---

## 📌 Sensor Pinout & Wiring Table

| Component | Sensor Model | ESP32 GPIO Pin | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Toxic / VOC Gas** | MQ-135 / MQ-2 | **GPIO 34** (ADC1_CH6) | Analog IN | Detects harmful chemical fumes & decomposition ($50 - 1000\text{ ppm}$) |
| **Moisture** | Capacitive / Resistive | **GPIO 35** (ADC1_CH7) | Analog IN | Detects wet waste liquids & leachate leakage ($0 - 100\%$) |
| **Proximity Sensor** | IR Obstacle / PIR | **GPIO 19** | Digital IN | Detects approaching hand or object at the intake hopper |
| **Temp & Humidity** | DHT11 / DHT22 | **GPIO 4** | Digital IN | Monitors ambient temperature & moisture accumulation |
| **Fill Level** | Ultrasonic HC-SR04 | Trig: **GPIO 5**<br>Echo: **GPIO 18** | Digital I/O | Measures container waste fill height ($0 - 100\%$) |
| **Auto-Lid Servo** *(Optional)* | SG90 Servo | **GPIO 13** | PWM OUT | Automatically opens hopper lid when proximity is detected |

> **Power Supply Note:**  
> - Power the ESP32 via Micro-USB (5V).  
> - The MQ-135 and HC-SR04 sensors require **5V (VIN)** for heating and echo range.  
> - Use an active-low or adjustable IR proximity module (adjust potentiometer until hand detection triggers LED).

---

## 🚀 Quick Step-by-Step Setup

### Step 1: Connect to the Same Wi-Fi Network
Both your laptop (running Django) and the ESP32 must be on the same local network:
- Use your home/lab Wi-Fi, or
- Turn on your phone's **Mobile Hotspot** and connect both your laptop and ESP32 to it.

### Step 2: Find Your Laptop's IPv4 Address
Open PowerShell and run:
```powershell
ipconfig
```
Find the **IPv4 Address** under your Wi-Fi adapter (e.g., `192.168.1.15`).

### Step 3: Run the Backend Server on `0.0.0.0:8000`
Run the Django server listening to all network interfaces:
```powershell
cd d:\SIH_demo\waste_management\backend
..\env\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### Step 4: Flash the ESP32
1. Open [`firmware/esp32_wasteguard.ino`](esp32_wasteguard.ino) in the Arduino IDE.
2. In lines 32–37, update:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `SERVER_HOST` (your laptop's IP address)
   - `STATION_ID` (e.g. `STATION-01`)
3. Select board **ESP32 Dev Module** and upload.
4. Open the Serial Monitor at **115200 baud** to see live transmission logs.

---

## 🌐 Supported REST Endpoints for ESP32

### 1. Ingest Telemetry (POST)
- **URL:** `POST http://<SERVER_IP>:8000/api/devices/sensor-data/`
- **Content-Type:** `application/json`
- **Payload Example:**
```json
{
  "station_id": "STATION-01",
  "proximity_detected": true,
  "temperature": 27.5,
  "humidity": 55.0,
  "gas_indicator": 130.0,
  "moisture": 25.0,
  "dry_fill_pct": 70.0,
  "wet_fill_pct": 40.0,
  "hazard_fill_pct": 15.0,
  "waste_category": "DRY",
  "device_status": "ONLINE"
}
```

### 2. Connection Ping (GET)
- **URL:** `GET http://<SERVER_IP>:8000/api/devices/ping/`
- **Purpose:** Fast connectivity verification during microcontroller startup.

### 3. Station Configuration & Thresholds (GET)
- **URL:** `GET http://<SERVER_IP>:8000/api/devices/config/?container_id=STATION-01`
- **Purpose:** Fetches current threshold limits and assigned waste stream.

