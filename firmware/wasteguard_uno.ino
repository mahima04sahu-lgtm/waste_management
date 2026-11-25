/*
 * WasteGuard - Arduino Uno Single-Station Prototype Firmware
 * Microcontroller: Arduino Uno (ATmega328P Rev3)
 * Target Station: STATION-01
 * 
 * Pin Allocations:
 *   - Digital Pin 2  : Inductive Metal Proximity Sensor (LJ12A3-4-Z/BX) [Active HIGH]
 *   - Digital Pin 3  : Object Entry IR Proximity Sensor [Active LOW / Beam Break]
 *   - Analog Pin A0  : Soil Moisture / Conductivity Sensor [0 - 1023 ADC]
 *   - PWM Pin 5      : Servo 1 (Primary Diverter Flap: Metal vs Wet/Dry split)
 *   - PWM Pin 6      : Servo 2 (Secondary Diverter Gate: Wet vs Dry)
 * 
 * Output:
 *   JSON telemetry lines printed to Serial at 115200 baud every 3 seconds.
 */

#include <Servo.h>

// --- Pin Definitions ---
const int PIN_METAL_SENSOR    = 2;
const int PIN_PROXIMITY_ENTRY = 3;
const int PIN_MOISTURE_ADC    = A0;
const int PIN_SERVO_PRIMARY   = 5;
const int PIN_SERVO_SECONDARY = 6;

// --- Station Configuration ---
const char* STATION_ID = "STATION-01";
const unsigned long TELEMETRY_INTERVAL_MS = 3000; // Dispatch every 3 seconds

// --- Servo Actuators ---
Servo servoPrimary;
Servo servoSecondary;

// --- State Variables ---
unsigned long lastTelemetryTime = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; } // Wait for USB Serial connection

  // Configure Pin Modes
  pinMode(PIN_METAL_SENSOR, INPUT);
  pinMode(PIN_PROXIMITY_ENTRY, INPUT_PULLUP);

  // Initialize Actuators (Home Neutral Position)
  servoPrimary.attach(PIN_SERVO_PRIMARY);
  servoSecondary.attach(PIN_SERVO_SECONDARY);
  servoPrimary.write(90);    // Neutral pass-through
  servoSecondary.write(0);   // Neutral position

  Serial.println(F("[SYSTEM] WasteGuard STATION-01 Firmware Initialized."));
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    // 1. Read Physical Sensors
    int metalRaw = digitalRead(PIN_METAL_SENSOR);
    bool metalDetected = (metalRaw == HIGH);

    int proximityRaw = digitalRead(PIN_PROXIMITY_ENTRY);
    bool proximityDetected = (proximityRaw == LOW); // Active-Low beam break

    int moistureAdc = analogRead(PIN_MOISTURE_ADC);
    // Normalize 10-bit ADC (0 - 1023) to 0.0% - 100.0% conductivity
    float moisturePct = (moistureAdc / 1023.0) * 100.0;

    // 2. Hardware Local Segregation Decision (Priority: Metal -> Wet -> Dry)
    if (metalDetected) {
      servoPrimary.write(45);    // Divert into Metal bin
      servoSecondary.write(0);
    } else if (moisturePct >= 45.0) {
      servoPrimary.write(90);    // Pass through to secondary
      servoSecondary.write(135); // Divert into Wet bin
    } else {
      servoPrimary.write(90);    // Pass through to secondary
      servoSecondary.write(0);     // Default into Dry bin
    }

    // 3. Format & Dispatch Serial JSON Packet (Read by PC 1 serial bridge)
    Serial.print(F("{\"station_id\":\""));
    Serial.print(STATION_ID);
    Serial.print(F("\",\"metal_detected\":"));
    Serial.print(metalDetected ? F("true") : F("false"));
    Serial.print(F(",\"moisture\":"));
    Serial.print(moisturePct, 1);
    Serial.print(F(",\"proximity_detected\":"));
    Serial.print(proximityDetected ? F("true") : F("false"));
    Serial.print(F(",\"device_status\":\"ONLINE\"}\n"));
  }
}
