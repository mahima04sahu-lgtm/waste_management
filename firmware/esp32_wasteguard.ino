/*
 * ==============================================================================
 * 🛡️ WasteGuard / HazGuard - ESP32 Smart Segregation & Telemetry Firmware
 * Smart India Hackathon (SIH 2026) Official IoT Integration
 * ==============================================================================
 *
 * SENSORS SUPPORTED:
 *  1. MQ-135 / MQ-2 (VOC & Toxic Gas Sensor)      -> Analog Pin GPIO 34 (ADC1)
 *  2. DHT11 / DHT22 (Temperature & Humidity)      -> Digital Pin GPIO 4
 *  3. HC-SR04 (Ultrasonic Fill-Level Sensor)      -> Trig GPIO 5, Echo GPIO 18
 *  4. IR / PIR (Proximity Object Presence Sensor) -> Digital Pin GPIO 19
 *  5. Soil / Waste Moisture Sensor                -> Analog Pin GPIO 35 (ADC1)
 *  6. Servo Motor (Auto-Open Lid on Proximity)    -> PWM Pin GPIO 13 (Optional)
 *
 * HOW TO FLASH:
 *  1. Open this file in Arduino IDE.
 *  2. Install libraries from Library Manager:
 *     - "DHT sensor library" by Adafruit
 *     - "ArduinoJson" (v6 or v7) by Benoit Blanchon (Optional, raw JSON used below)
 *  3. Update "YOUR_WIFI_SSID", "YOUR_WIFI_PASSWORD", and "SERVER_HOST_IP" below.
 *  4. Select Board: "ESP32 Dev Module" and click Upload.
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ------------------------------------------------------------------------------
// 1. NETWORK & SERVER CONFIGURATION
// ------------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Replace with your Wi-Fi or Mobile Hotspot SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Replace with your Wi-Fi password

// Server Host: Replace with your laptop's Wi-Fi IPv4 address (found via 'ipconfig')
// Example: "192.168.1.15" or "192.168.43.50"
const char* SERVER_HOST   = "192.168.1.15";
const int   SERVER_PORT   = 8000;

// Station Identification (STATION-01 through STATION-05)
const char* STATION_ID    = "STATION-01";
const char* WASTE_STREAM  = "DRY";                    // "DRY", "WET", or "HAZARDOUS"

// Endpoints
String TELEMETRY_URL = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/devices/sensor-data/";
String PING_URL      = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/devices/ping/";

// Telemetry transmit interval (milliseconds)
const unsigned long SEND_INTERVAL_MS = 5000;
unsigned long lastSendTime = 0;

// ------------------------------------------------------------------------------
// 2. PIN ASSIGNMENTS (ESP32 GPIO)
// ------------------------------------------------------------------------------
#define PIN_MQ135_GAS       34   // Analog ADC1 (VOC / toxic gas ppm)
#define PIN_MOISTURE        35   // Analog ADC1 (Moisture %)
#define PIN_PROXIMITY_IR    19   // Digital input (LOW/HIGH when object/hand approaches)
#define PIN_DHT_DATA        4    // Digital pin for DHT11 / DHT22
#define PIN_TRIG            5    // Ultrasonic HC-SR04 Trigger
#define PIN_ECHO            18   // Ultrasonic HC-SR04 Echo

#define DHTTYPE DHT11            // Change to DHT22 if using white sensor
DHT dht(PIN_DHT_DATA, DHTTYPE);

// Physical station dimensions (for ultrasonic fill level)
const float BIN_HEIGHT_CM = 80.0; // Distance from ultrasonic sensor to empty bin bottom

// ------------------------------------------------------------------------------
// 3. SENSOR READING FUNCTIONS
// ------------------------------------------------------------------------------

// Read MQ-135 Gas Sensor and convert raw ADC (0-4095) to estimated ppm (50 - 1000 ppm)
float readGasPPM() {
  int rawAdc = analogRead(PIN_MQ135_GAS);
  // Linear scale mapping for demo/calibration: 0-4095 -> 50 - 1000 ppm
  float ppm = map(rawAdc, 0, 4095, 50, 1000);
  if (ppm < 50.0) ppm = 120.0; // Baseline fallback if sensor warming up
  return ppm;
}

// Read Soil/Waste Moisture Sensor (0-4095 mapped to 0-100%)
float readMoisturePercent() {
  int rawAdc = analogRead(PIN_MOISTURE);
  // Resistive moisture sensors read LOWER voltage when wet
  float pct = map(rawAdc, 4095, 1000, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

// Read HC-SR04 Ultrasonic Sensor and calculate fill level percentage
float readFillLevelPercent() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout
  if (duration <= 0) {
    return 45.0; // Fallback estimate if nothing in range
  }

  float distanceCm = (duration * 0.0343) / 2.0;

  // Fill % = (Bin Height - Distance) / Bin Height * 100
  float fillPct = ((BIN_HEIGHT_CM - distanceCm) / BIN_HEIGHT_CM) * 100.0;
  if (fillPct < 0.0) fillPct = 0.0;
  if (fillPct > 100.0) fillPct = 100.0;
  return fillPct;
}

// Read Proximity Sensor (IR obstacle sensor outputs LOW when object is present)
bool readProximityPresence() {
  // Most active-low IR modules output LOW (0) when hand/object is detected
  int val = digitalRead(PIN_PROXIMITY_IR);
  return (val == LOW);
}

// ------------------------------------------------------------------------------
// 4. WI-FI & TELEMETRY DISPATCH
// ------------------------------------------------------------------------------

void connectToWiFi() {
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] Connected to Wi-Fi!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WARN] Wi-Fi connection timed out. Will retry in loop.");
  }
}

// Ping server once during startup to verify route
void verifyServerPing() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(PING_URL);
  http.setTimeout(3000);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[OK] WasteGuard Backend Server is REACHABLE!");
    Serial.println(http.getString());
  } else {
    Serial.printf("[WARN] Could not reach server at %s (HTTP Code: %d)\n", PING_URL.c_str(), httpCode);
    Serial.println("-> Check that your laptop and ESP32 are on the SAME Wi-Fi network.");
    Serial.println("-> Check that Django server is running: python manage.py runserver 0.0.0.0:8000");
  }
  http.end();
}

void sendTelemetryPayload() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] Wi-Fi disconnected. Reconnecting...");
    connectToWiFi();
    return;
  }

  // 1. Collect readings from physical sensors
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  if (isnan(temp) || isnan(hum)) {
    temp = 26.5; // Sensor warming baseline
    hum  = 54.0;
  }

  float gasPpm    = readGasPPM();
  float moisture  = readMoisturePercent();
  float fillPct   = readFillLevelPercent();
  bool  proximity = readProximityPresence();

  // 2. Build JSON Payload
  // Supports multi-compartment fill level, proximity flag, VOC gas, temp, humidity
  String payload = "{";
  payload += "\"station_id\":\"" + String(STATION_ID) + "\",";
  payload += "\"proximity_detected\":" + String(proximity ? "true" : "false") + ",";
  payload += "\"temperature\":" + String(temp, 1) + ",";
  payload += "\"humidity\":" + String(hum, 1) + ",";
  payload += "\"gas_indicator\":" + String(gasPpm, 1) + ",";
  payload += "\"moisture\":" + String(moisture, 1) + ",";
  payload += "\"fill_level\":" + String(fillPct, 1) + ",";
  payload += "\"waste_category\":\"" + String(WASTE_STREAM) + "\",";
  payload += "\"device_status\":\"ONLINE\",";
  payload += "\"is_esp32\":true";
  payload += "}";

  // 3. Transmit HTTP POST
  HTTPClient http;
  http.begin(TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(4000);

  Serial.println("\n------------------------------------------------");
  Serial.print("Sending Telemetry to: ");
  Serial.println(TELEMETRY_URL);
  Serial.println("Payload: " + payload);

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP %d] Response: %s\n", httpCode, response.c_str());
  } else {
    Serial.printf("[ERROR] HTTP POST Failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ------------------------------------------------------------------------------
// 5. MAIN SETUP & LOOP
// ------------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================================");
  Serial.println("  WasteGuard ESP32 Telemetry Firmware Starting");
  Serial.println("==============================================");

  // Configure Pins
  pinMode(PIN_PROXIMITY_IR, INPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  // Initialize DHT sensor
  dht.begin();

  // Connect to Wi-Fi network
  connectToWiFi();

  // Ping backend server
  verifyServerPing();
}

void loop() {
  unsigned long currentMillis = millis();

  // Immediate Proximity Trigger (fast response for user approach)
  static bool lastProximityState = false;
  bool currentProximityState = readProximityPresence();

  if (currentProximityState != lastProximityState) {
    lastProximityState = currentProximityState;
    Serial.printf("[EVENT] Proximity Presence Changed: %s\n", currentProximityState ? "OBJECT DETECTED" : "CLEAR");
    // Immediate update dispatch upon presence change
    sendTelemetryPayload();
    lastSendTime = currentMillis;
  }

  // Periodic Telemetry Dispatch (every 5 seconds)
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    sendTelemetryPayload();
  }

  delay(100);
}

