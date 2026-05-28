"""
Bantay-Dagitab — Serial USB Bridge
===================================
Reads JSON power readings from the NodeMCU over USB serial and
POSTs them to the Django backend as IoT readings.

NO WiFi needed on the ESP8266. Just a USB cable.

USAGE
-----
1. Upload usb_power_monitor.ino to your NodeMCU via Arduino IDE.
2. Close the Arduino IDE Serial Monitor (so this script can use the port).
3. Run this script:

   python serial_bridge.py

   The script auto-detects your NodeMCU's COM port.
   Or specify manually:  python serial_bridge.py --port COM3

REQUIREMENTS
------------
   pip install pyserial requests

The script will:
  - Auto-detect the baud rate (115200)
  - Read JSON lines from the NodeMCU
  - POST each reading to Django's /api/iot/readings/dev-inject/ endpoint
  - Print live wattage to the terminal so you can see what's happening
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

from serial.tools import list_ports

try:
    import serial
except ImportError:
    print("ERROR: pyserial is not installed.")
    print("Run:  pip install pyserial")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests is not installed.")
    print("Run:  pip install requests")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_BAUD = 115200
DEFAULT_BACKEND = "http://localhost:8000/api"
DEFAULT_DEVICE_ID = "meter_sampaloc_001"

# USB-to-Serial chip keywords used by NodeMCU / ESP8266 boards
ESP_CHIP_KEYWORDS = ["CH340", "CH341", "CP210", "CP2102", "FTDI", "USB-SERIAL", "USB Serial"]


def auto_detect_port() -> str | None:
    """Scan COM ports for a NodeMCU / ESP8266 USB-to-Serial chip."""
    ports = list_ports.comports()
    if not ports:
        return None

    print("[serial] Scanning COM ports...")
    candidates = []
    for p in ports:
        desc = (p.description or "").upper()
        mfr = (p.manufacturer or "").upper()
        hwid = (p.hwid or "").upper()
        label = f"{p.device}  {p.description}  (mfr={p.manufacturer or '?'}, hwid={p.hwid or '?'})"

        for keyword in ESP_CHIP_KEYWORDS:
            if keyword.upper() in desc or keyword.upper() in mfr or keyword.upper() in hwid:
                candidates.append(p)
                print(f"  ✓ {label}")
                break
        else:
            print(f"    {label}")

    if len(candidates) == 1:
        port = candidates[0].device
        print(f"[serial] Auto-detected NodeMCU on {port} ({candidates[0].description})")
        return port
    elif len(candidates) > 1:
        print(f"[serial] Found {len(candidates)} possible ports:")
        for i, c in enumerate(candidates):
            print(f"  [{i + 1}] {c.device} — {c.description}")
        choice = input("Pick a port number [1]: ").strip()
        idx = int(choice) - 1 if choice.isdigit() else 0
        idx = max(0, min(idx, len(candidates) - 1))
        return candidates[idx].device
    else:
        return None


def login(base_url: str, username: str, password: str) -> str:
    """Authenticate with Django and return a JWT access token."""
    url = f"{base_url}/token/"
    print(f"[auth] Logging in as '{username}' at {url}")
    resp = requests.post(url, json={"username": username, "password": password}, timeout=10)
    if resp.status_code != 200:
        print(f"[auth] Login failed: {resp.status_code} {resp.text[:200]}")
        sys.exit(1)
    data = resp.json()
    token = data.get("access")
    if not token:
        print(f"[auth] No access token in response: {data}")
        sys.exit(1)
    print("[auth] Login OK — JWT token acquired.")
    return token


def post_reading(base_url: str, token: str, device_id: str, avg_wattage: float):
    """POST a single reading to the dev-inject endpoint."""
    url = f"{base_url}/iot/readings/dev-inject/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "device_id": device_id,
        "avg_wattage": round(avg_wattage, 2),
        "count": 1,
        "interval_minutes": 1,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 201:
            return True
        elif resp.status_code == 401:
            print("[post] 401 Unauthorized — token may have expired.")
            return False
        else:
            print(f"[post] Unexpected {resp.status_code}: {resp.text[:200]}")
            return True  # Don't exit on transient errors
    except requests.RequestException as e:
        print(f"[post] Network error: {e}")
        return True  # Keep trying


def main():
    parser = argparse.ArgumentParser(
        description="Bantay-Dagitab USB Serial Bridge — reads NodeMCU sensor data over USB and posts to Django.",
    )
    parser.add_argument(
        "--port", "-p",
        default=None,
        help="Serial port (e.g., COM3). Auto-detected if not specified.",
    )
    parser.add_argument(
        "--baud", "-b",
        type=int,
        default=DEFAULT_BAUD,
        help=f"Baud rate (default: {DEFAULT_BAUD})",
    )
    parser.add_argument(
        "--backend", "-u",
        default=DEFAULT_BACKEND,
        help=f"Django API base URL (default: {DEFAULT_BACKEND})",
    )
    parser.add_argument(
        "--device-id", "-d",
        default=DEFAULT_DEVICE_ID,
        help=f"Device ID for Contract A (default: {DEFAULT_DEVICE_ID})",
    )
    parser.add_argument(
        "--username",
        default=None,
        help="Django username for JWT auth (will prompt if not provided)",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Django password for JWT auth (will prompt if not provided)",
    )
    args = parser.parse_args()

    # --- Auth ---
    username = args.username
    password = args.password
    if not username:
        username = input("Django username: ").strip()
    if not password:
        import getpass
        password = getpass.getpass("Django password: ")

    token = login(args.backend, username, password)

    # --- Serial connection ---
    port = args.port
    if not port:
        port = auto_detect_port()
        if not port:
            print("[serial] Could not auto-detect NodeMCU.")
            print()
            print("TIPS:")
            print("  1. Make sure the USB cable is plugged in.")
            print("  2. Close the Arduino IDE Serial Monitor.")
            print("  3. Specify manually: python serial_bridge.py --port COM3")
            sys.exit(1)

    print(f"[serial] Opening {port} at {args.baud} baud...")
    try:
        ser = serial.Serial(port, args.baud, timeout=2)
    except serial.SerialException as e:
        print(f"[serial] Could not open {port}: {e}")
        print()
        print("TIPS:")
        print("  1. Close the Arduino IDE Serial Monitor first!")
        print("  2. Check the correct COM port in Device Manager.")
        print("  3. Make sure the USB cable is connected.")
        sys.exit(1)

    print(f"[serial] Connected! Waiting for NodeMCU data...")
    print()
    print("=" * 70)
    print("  BANTAY-DAGITAB USB BRIDGE — LIVE POWER READINGS")
    print("  Press Ctrl+C to stop.")
    print("=" * 70)
    print()

    readings_posted = 0
    last_token_time = time.time()

    try:
        while True:
            line = ser.readline()
            if not line:
                continue

            line = line.decode("utf-8", errors="replace").strip()
            if not line or not line.startswith("{"):
                # Skip non-JSON lines (boot messages, garbage, etc.)
                if line:
                    print(f"  [debug] {line}")
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                print(f"  [skip] Bad JSON: {line[:80]}")
                continue

            # Handle status messages
            if "status" in data:
                print(f"  [NodeMCU] {data}")
                continue

            # Parse a power reading
            avg_wattage = data.get("avg_wattage", 0.0)
            current_amps = data.get("current_amps", 0.0)
            ac_rms = data.get("ac_rms", 0.0)
            bias = data.get("bias", 0.0)

            now_str = datetime.now().strftime("%H:%M:%S")
            print(
                f"  [{now_str}]  "
                f"⚡ {avg_wattage:7.1f} W  |  "
                f"🔌 {current_amps:.3f} A  |  "
                f"wave={ac_rms:.1f}  bias={bias:.0f}"
            )

            # Refresh token every 4 minutes (JWT access tokens typically expire in 5)
            if time.time() - last_token_time > 240:
                print("  [auth] Refreshing JWT token...")
                token = login(args.backend, username, password)
                last_token_time = time.time()

            # POST to Django
            success = post_reading(args.backend, token, args.device_id, avg_wattage)
            if success:
                readings_posted += 1
                if readings_posted % 10 == 0:
                    print(f"  [bridge] Total readings posted: {readings_posted}")
            else:
                # Token expired, try re-login
                print("  [auth] Re-authenticating...")
                token = login(args.backend, username, password)
                last_token_time = time.time()
                post_reading(args.backend, token, args.device_id, avg_wattage)

    except KeyboardInterrupt:
        print()
        print(f"[bridge] Stopped. Total readings posted: {readings_posted}")
    finally:
        ser.close()
        print("[serial] Port closed.")


if __name__ == "__main__":
    main()
