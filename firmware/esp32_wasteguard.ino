/*
 * ==============================================================================
 * ♻️ WasteGuard - ESP32 Smart Waste Segregation Telemetry Firmware
 * Smart India Hackathon (SIH 2026) Prototype
 * ==============================================================================
 *
 * HARDWARE SENSORS SUPPORTED:
 *  1. Inductive Metal Sensor (NPN/PNP Inductive Proximity) -> GPIO 22 (Digital IN)
 *  2. Soil / Waste Moisture Sensor (Conductivity/Resistive) -> GPIO 35 (Analog ADC1)
 *  3. IR / Proximity Sensor (Optional Object Detection)    -> GPIO 19 (Digital IN)
 *
 * HOW TO FLASH:
 *  1. Open this file in the Arduino IDE.
 *  2. Connect your laptop and ESP32 to the SAME Wi-Fi network (or mobile hotspot).
 *  3. Verify your laptop's IPv4 address via 'ipconfig' (currently 192.168.29.66).
 *  4. Update WIFI_SSID, WIFI_PASSWORD, and SERVER_HOST below.
 *  5. Board: "ESP32 Dev Module", Baud: 115200. Click Upload.
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ------------------------------------------------------------------------------
// 1. WI-FI & BACKEND SERVER CONFIGURATION
// ------------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Replace with your Wi-Fi or Hotspot SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Replace with your Wi-Fi password

// Your computer's local Wi-Fi IP running Django:
const char* SERVER_HOST   = "192.168.29.66";
const int   SERVER_PORT   = 8000;

// Station Identifier
const char* STATION_ID    = "STATION-01";

// Endpoints
String TELEMETRY_URL = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/devices/sensor-data/";
String PING_URL      = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/devices/ping/?station_id=" + String(STATION_ID);

// Periodic telemetry transmit interval (milliseconds)
const unsigned long SEND_INTERVAL_MS = 3000;
unsigned long lastSendTime = 0;

// ------------------------------------------------------------------------------
// 2. PIN ASSIGNMENTS
// ------------------------------------------------------------------------------
#define PIN_METAL_SENSOR    22   // Digital IN from Inductive Metal Sensor (Active-HIGH or LOW)
#define PIN_MOISTURE_SENSOR 35   // Analog ADC1 from Moisture Sensor (0 - 4095)
#define PIN_PROXIMITY_IR    19   // Optional IR / Proximity sensor (Active-LOW)

// Set to true if your inductive metal sensor outputs LOW on metal detection
const bool METAL_ACTIVE_LOW = false; 

// ------------------------------------------------------------------------------
// 3. SENSOR READING FUNCTIONS
// ------------------------------------------------------------------------------

// Read Inductive Metal Sensor
bool readMetalDetected() {
  int raw = digitalRead(PIN_METAL_SENSOR);
  return METAL_ACTIVE_LOW ? (raw == LOW) : (raw == HIGH);
}

// Read Moisture Sensor (converted to percentage 0.0 - 100.0%)
float readMoisturePercent() {
  int rawAdc = analogRead(PIN_MOISTURE_SENSOR);
  // Resistive/Capacitive moisture sensors: dry reading ~4095, wet reading ~1200
  float pct = map(rawAdc, 4095, 1200, 0, 100);
  if (pct < 0.0) pct = 0.0;
  if (pct > 100.0) pct = 100.0;
  return pct;
}

// Read optional proximity presence
bool readProximityPresence() {
  int val = digitalRead(PIN_PROXIMITY_IR);
  return (val == LOW);
}

// ------------------------------------------------------------------------------
// 4. WI-FI MANAGEMENT & HTTP DISPATCH
// ------------------------------------------------------------------------------

void connectToWiFi() {
  Serial.print("[Wi-Fi] Connecting to: ");
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
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.print("[Wi-Fi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[Wi-Fi] Warning: Connection timed out. Will retry.");
  }
}

// Send lightweight heartbeat ping to backend
void sendHeartbeatPing() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(PING_URL);
  http.setTimeout(2500);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[PING] Heartbeat successful (Backend is ONLINE)");
  } else {
    Serial.printf("[PING] Server unreachable (HTTP %d). Ensure Django is on 0.0.0.0:8000\n", httpCode);
  }
  http.end();
}

// Send live sensor reading and trigger rule-based segregation
void sendTelemetryPayload() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Disconnected, reconnecting...");
    connectToWiFi();
    return;
  }

  bool metalDetected = readMetalDetected();
  float moistureVal  = readMoisturePercent();
  bool proximity     = readProximityPresence();

  // Construct JSON payload
  String payload = "{";
  payload += "\"container_id\":\"" + String(STATION_ID) + "\",";
  payload += "\"metal_detected\":" + String(metalDetected ? "true" : "false") + ",";
  payload += "\"moisture\":" + String(moistureVal, 1) + ",";
  payload += "\"proximity_detected\":" + String(proximity ? "true" : "false") + ",";
  payload += "\"device_status\":\"ONLINE\"";
  payload += "}";

  HTTPClient http;
  http.begin(TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3500);

  Serial.println("\n------------------------------------------------");
  Serial.print("Sending Live Sensor Data to: ");
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
  Serial.println("  WasteGuard Live Telemetry Client Starting");
  Serial.println("==============================================");

  pinMode(PIN_METAL_SENSOR, INPUT);
  pinMode(PIN_PROXIMITY_IR, INPUT);

  connectToWiFi();
  sendHeartbeatPing();
}

void loop() {
  unsigned long currentMillis = millis();

  // Instant trigger if metal is detected
  static bool lastMetalState = false;
  bool currentMetalState = readMetalDetected();

  if (currentMetalState && !lastMetalState) {
    Serial.println("\n[SENSOR EVENT] Metal Object Detected! Transmitting instantly...");
    sendTelemetryPayload();
    lastSendTime = currentMillis;
  }
  lastMetalState = currentMetalState;

  // Regular periodic sync every SEND_INTERVAL_MS (3 seconds)
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    sendTelemetryPayload();
  }

  delay(50);
}
