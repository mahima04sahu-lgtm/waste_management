"""
WasteGuard - PC 1 Serial-to-HTTP Gateway Bridge
================================================
Run this Python script on the PC where your Arduino Uno is connected via USB.
It reads JSON telemetry from the Arduino Serial port and transmits it across
the local Wi-Fi to your dashboard server (192.168.29.66:8000).

Requirements:
  pip install pyserial requests

Usage:
  python pc1_serial_bridge.py
"""

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None

import requests
import json
import time
import sys
import os

# Try loading .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
except Exception:
    pass

# ==============================================================================
# CONFIGURATION (loaded from .env or fallback defaults)
# ==============================================================================
SERVER_HOST = os.getenv("SERVER_HOST_IP", "192.168.29.66")
SERVER_PORT = os.getenv("SERVER_PORT", "8000")
BASE_URL = os.getenv("SERVER_BASE_URL", f"http://{SERVER_HOST}:{SERVER_PORT}")
SERVER_URL = os.getenv("DEVICE_TELEMETRY_URL", f"{BASE_URL}/api/devices/sensor-data/")
HEALTH_URL = os.getenv("DEVICE_PING_URL", f"{BASE_URL}/api/devices/ping/?station_id=STATION-01")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "WG-STATION01-KEY-9842F1A63C2026")

# Serial settings
BAUD_RATE = int(os.getenv("SERIAL_BAUD_RATE", 115200))
# Leave as None to auto-detect Arduino port, or set explicitly e.g. "COM3" / "/dev/ttyACM0"
MANUAL_PORT = None 


def auto_detect_arduino():
    if MANUAL_PORT:
        return MANUAL_PORT
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = p.description.lower()
        if 'arduino' in desc or 'ch340' in desc or 'usb serial' in desc or 'cp210' in desc:
            return p.device
    if ports:
        return ports[0].device
    return None


def test_server_connectivity():
    print(f"\n[1/2] Testing network link to WasteGuard Server ({SERVER_URL})...")
    try:
        headers = {"X-API-Key": DEVICE_API_KEY}
        r = requests.get(HEALTH_URL, headers=headers, timeout=4)
        if r.status_code == 200:
            print(f"      \033[92m[CONNECTED]\033[0m WasteGuard server responded: {r.json()}")
            return True
        else:
            print(f"      \033[93m[WARNING]\033[0m Server returned status {r.status_code}")
            return True
    except Exception as e:
        print(f"      \033[91m[FAILED]\033[0m Cannot reach {SERVER_URL}.")
        print(f"      Check if both PCs are on the same Wi-Fi and laptop firewall allows port 8000.")
        return False


def main():
    print("=" * 65)
    print(" WasteGuard Arduino Uno Telemetry Bridge (PC 1)")
    print("=" * 65)

    test_server_connectivity()

    port = auto_detect_arduino()
    if not port:
        print("\n\033[91m[ERROR]\033[0m No Arduino Uno / COM port detected! Check USB cable.")
        sys.exit(1)

    print(f"\n[2/2] Connecting to Arduino on port \033[94m{port}\033[0m at {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=2)
        time.sleep(2)  # Wait for Arduino reset after DTR toggle
        print(f"      \033[92m[READY]\033[0m Serial link active! Streaming sensor data...\n")
    except Exception as e:
        print(f"\033[91m[ERROR]\033[0m Failed to open {port}: {e}")
        sys.exit(1)

    packet_count = 0
    while True:
        try:
            raw_line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not raw_line:
                continue

            # Check if line is a JSON payload from wasteguard_uno.ino
            if raw_line.startswith('{') and raw_line.endswith('}'):
                try:
                    payload = json.loads(raw_line)
                    packet_count += 1
                    
                    # Forward to WasteGuard Django server
                    t0 = time.time()
                    resp = requests.post(SERVER_URL, json=payload, headers={"Content-Type": "application/json", "X-API-Key": DEVICE_API_KEY}, timeout=3)
                    elapsed = (time.time() - t0) * 1000

                    if resp.status_code in (200, 201):
                        data = resp.json()
                        decision = data.get('segregation_decision', 'UNKNOWN')
                        certainty = data.get('certainty', 0.0)
                        print(f"[{packet_count:04d}] Ingested -> Category: \033[92m{decision:<5}\033[0m | Certainty: {certainty:.1f}% | Latency: {elapsed:.0f}ms")
                    else:
                        print(f"[{packet_count:04d}] Server status {resp.status_code}: {resp.text}")

                except json.JSONDecodeError:
                    print(f"[RAW SERIAL] {raw_line}")
            else:
                # System boot logs or debug print
                print(f"[ARDUINO] {raw_line}")

        except KeyboardInterrupt:
            print("\nBridge stopped by user.")
            break
        except Exception as e:
            print(f"[WARN] Connection error: {e}")
            time.sleep(1)

    ser.close()


if __name__ == "__main__":
    main()
