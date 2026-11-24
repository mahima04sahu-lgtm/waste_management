# 📡 WasteGuard Hardware Wi-Fi Integration Guide

This guide details how to connect your **Arduino Uno / ESP32** microcontroller over Wi-Fi to transmit live sensor telemetry into the WasteGuard dashboard in real time.

---

## 📌 Sensor Pinout & Wiring

| Sensor Component | Physical Sensor | Microcontroller Pin | Signal Type | Rule Applied |
| :--- | :--- | :--- | :--- | :--- |
| **Metal Sensor** | Inductive Proximity Sensor | **Digital Pin D2** (Uno) / **GPIO 22** (ESP32) | Digital IN (HIGH when metal present) | **Priority 1: Metal** |
| **Moisture Sensor** | Soil / Liquid Moisture Probe | **Analog Pin A0** (Uno) / **GPIO 35** (ESP32) | Analog IN ($0 - 100\%$) | **Priority 2: Wet** ($\ge 45\%$) |
| **Residual Category** | *(No sensor triggered)* | — | — | **Priority 3: Dry** (Neither) |

---

## 🌐 Network Configuration

1. **Same Wi-Fi Network**: Connect your laptop and your Arduino / ESP32 to the **same Wi-Fi router or phone mobile hotspot**.
2. **Laptop IPv4 Address**: `192.168.29.66` (or run `ipconfig` in PowerShell if your IP changes).
3. **Backend Server Port**: `8000` (Django server runs on `0.0.0.0:8000`).

---

## 🚀 Step-by-Step Hardware Setup

### Step 1: Open Firmware in Arduino IDE
- If using **ESP32**: Open [`firmware/esp32_wasteguard.ino`](esp32_wasteguard.ino)
- If using **Arduino Uno with Wi-Fi**: Open [`firmware/arduino_uno_wifi_wasteguard.ino`](arduino_uno_wifi_wasteguard.ino)

### Step 2: Configure Wi-Fi Credentials
In the firmware file, enter your Wi-Fi details:
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "192.168.29.66"; // Your laptop's IP
const int   SERVER_PORT   = 8000;
```

### Step 3: Flash to Microcontroller
- Select your Board and COM Port in the Arduino IDE.
- Click **Upload**.
- Open the **Serial Monitor** (115200 baud for ESP32, 9600 for Uno).
- You will see:
  ```text
  [Wi-Fi] Connected successfully!
  [PING] Heartbeat successful (Backend is ONLINE)
  Sending Live Sensor Data to: http://192.168.29.66:8000/api/devices/sensor-data/
  ```

---

## 🔄 Live Dashboard Experience

When your Arduino / ESP32 powers on and connects to Wi-Fi:
1. The status badge at [http://127.0.0.1:8000/dashboard.html](http://127.0.0.1:8000/dashboard.html) automatically switches to **● Arduino Connected** (Live Sync).
2. The **Inductive Metal Sensor** and **Moisture Sensor** display real-time live readings.
3. Placing a metal object near the sensor immediately routes the event to **Metal** and increments the Metal counter.
4. Dipping the moisture sensor into water immediately routes the event to **Wet** and increments the Wet counter.
5. In the absence of both, the item is classified as **Dry**.
6. The dashboard automatically syncs every **2.5 seconds** without manual page refresh.
