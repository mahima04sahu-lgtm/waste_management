/*
 * ==============================================================================
 * ♻️ WasteGuard - Arduino Uno WiFi Smart Waste Segregation Firmware
 * Smart India Hackathon (SIH 2026) Prototype
 * Compatible with Arduino Uno WiFi Rev2, Arduino Uno R4 WiFi, or Uno + ESP-01
 * ==============================================================================
 *
 * SENSORS WIRING FOR ARDUINO UNO:
 *  1. Inductive Metal Sensor -> Digital Pin D2 (IN)
 *  2. Soil / Waste Moisture  -> Analog Pin A0  (ANALOG IN)
 *  3. VCC -> 5V
 *  4. GND -> GND
 * ==============================================================================
 */

#if defined(ARDUINO_UNOR4_WIFI)
  #include <WiFiS3.h>
#elif defined(ARDUINO_AVR_UNO_WIFI_REV2)
  #include <WiFiNINA.h>
#else
  // For standard Uno with ESP8266 AT firmware, or generic WiFi
  #include <WiFiS3.h>
#endif

// Wi-Fi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your Laptop's local IPv4 Address (found via 'ipconfig')
const char* SERVER_HOST   = "192.168.29.66";
const int   SERVER_PORT   = 8000;
const char* STATION_ID    = "STATION-01";

// Pin Definitions
const int PIN_METAL       = 2;   // Digital Pin 2 for Inductive Metal Sensor
const int PIN_MOISTURE    = A0;  // Analog Pin A0 for Moisture Sensor

WiFiClient client;
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 3000; // Send telemetry every 3 seconds

void setup() {
  Serial.begin(9600);
  pinMode(PIN_METAL, INPUT);

  Serial.println(F("\n[WasteGuard] Arduino Uno WiFi Prototype Initializing..."));
  
  // Connect to WiFi
  Serial.print(F("Connecting to WiFi: "));
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[OK] Connected to WiFi!"));
    Serial.print(F("Arduino IP: "));
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(F("\n[WARN] WiFi connection failed. Will retry."));
  }
}

void loop() {
  unsigned long now = millis();

  // Instant trigger if metal detected
  static bool lastMetal = false;
  bool metalDetected = (digitalRead(PIN_METAL) == HIGH);

  if (metalDetected && !lastMetal) {
    Serial.println(F("\n[EVENT] Metal Detected! Sending immediately..."));
    sendData();
    lastSend = now;
  }
  lastMetal = metalDetected;

  // Periodic Transmission
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    sendData();
  }

  delay(50);
}

void sendData() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    return;
  }

  // 1. Read Sensors
  bool metal = (digitalRead(PIN_METAL) == HIGH);
  int rawMoist = analogRead(PIN_MOISTURE);
  // Map raw analog reading (0-1023) to percentage (0.0 - 100.0%)
  float moisture = map(rawMoist, 1023, 200, 0, 100);
  if (moisture < 0.0) moisture = 0.0;
  if (moisture > 100.0) moisture = 100.0;

  // 2. Build JSON String
  String json = "{";
  json += "\"container_id\":\"" + String(STATION_ID) + "\",";
  json += "\"metal_detected\":" + String(metal ? "true" : "false") + ",";
  json += "\"moisture\":" + String(moisture, 1) + ",";
  json += "\"device_status\":\"ONLINE\"";
  json += "}";

  // 3. Send HTTP POST
  Serial.println(F("\nConnecting to WasteGuard server..."));
  if (client.connect(SERVER_HOST, SERVER_PORT)) {
    client.println(F("POST /api/devices/sensor-data/ HTTP/1.1"));
    client.println(String("Host: ") + SERVER_HOST + ":" + SERVER_PORT);
    client.println(F("Content-Type: application/json"));
    client.println(F("Connection: close"));
    client.print(F("Content-Length: "));
    client.println(json.length());
    client.println();
    client.println(json);

    Serial.print(F("Payload Sent: "));
    Serial.println(json);

    // Read response line
    unsigned long timeout = millis();
    while (client.connected() && millis() - timeout < 2000) {
      if (client.available()) {
        String line = client.readStringUntil('\n');
        if (line.startsWith("HTTP/1.1")) {
          Serial.println(String("[Server Response] ") + line);
        }
      }
    }
    client.stop();
  } else {
    Serial.println(F("[ERROR] Connection to WasteGuard server failed."));
  }
}

