"""Backend tests for live tracking: geocoding, WebSocket, simulator."""
import asyncio
import json
import os
import re
import time
import pytest
import requests
import websockets

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    from pathlib import Path
    env = Path('/app/frontend/.env').read_text()
    for line in env.splitlines():
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
            break
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

# WebSocket URL: try public wss first, fall back to internal ws
PUBLIC_WS = re.sub(r'^http', 'ws', BASE_URL) + "/api/ws/tracking"
INTERNAL_WS = "ws://localhost:8001/api/ws/tracking"


def _create_booking(pickup="Connaught Place, New Delhi",
                    dropoff="India Gate, New Delhi",
                    distance_km=3.0):
    payload = {
        "vehicle_type": "tata_ace",
        "pickup_address": pickup,
        "dropoff_address": dropoff,
        "distance_km": distance_km,
        "fare": 0.0,
        "sender_phone": "9876543210",
        "receiver_name": "TEST_Tracker",
        "receiver_phone": "9123456789",
        "goods_note": "TEST_WS goods",
        "payment_method": "upi",
    }
    r = requests.post(f"{API}/bookings", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Geocoding on booking create ----------
class TestGeocodingOnCreate:
    def test_create_populates_all_six_coords(self):
        b = _create_booking()
        for k in ("pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng",
                  "driver_lat", "driver_lng"):
            assert b.get(k) is not None, f"{k} missing"
            assert isinstance(b[k], (int, float)), f"{k} not numeric"
        # sanity: New Delhi is around lat 28.5-28.7, lng 77.1-77.3
        assert 27.5 < b["pickup_lat"] < 29.5
        assert 76.5 < b["pickup_lng"] < 78.0
        assert 27.5 < b["dropoff_lat"] < 29.5
        # driver ~1-2 km from pickup
        assert abs(b["driver_lat"] - b["pickup_lat"]) < 0.05
        assert abs(b["driver_lng"] - b["pickup_lng"]) < 0.05

    def test_get_returns_coords(self):
        b = _create_booking()
        r = requests.get(f"{API}/bookings/{b['id']}", timeout=15)
        assert r.status_code == 200
        got = r.json()
        for k in ("pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng",
                  "driver_lat", "driver_lng"):
            assert got.get(k) is not None


# ---------- WebSocket helpers ----------
async def _ws_connect(booking_id, use_public=True):
    """Try public URL first; if it fails (ingress no-WS), fall back to internal."""
    url_pub = f"{PUBLIC_WS}/{booking_id}"
    url_int = f"{INTERNAL_WS}/{booking_id}"
    if use_public:
        try:
            return await asyncio.wait_for(websockets.connect(url_pub), timeout=5), "public"
        except Exception:
            pass
    return await asyncio.wait_for(websockets.connect(url_int), timeout=5), "internal"


async def _collect(ws, n=1, timeout=6.0):
    msgs = []
    end = time.time() + timeout
    while len(msgs) < n and time.time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
            msgs.append(json.loads(raw))
        except asyncio.TimeoutError:
            break
    return msgs


# ---------- WebSocket snapshot ----------
class TestWebSocketSnapshot:
    def test_snapshot_on_connect(self):
        b = _create_booking()

        async def run():
            ws, mode = await _ws_connect(b["id"])
            try:
                msgs = await _collect(ws, n=1, timeout=6.0)
                assert msgs, f"no snapshot msg (mode={mode})"
                snap = msgs[0]
                assert snap.get("type") == "snapshot", snap
                for k in ("status", "driver_lat", "driver_lng",
                          "pickup_lat", "pickup_lng",
                          "dropoff_lat", "dropoff_lng"):
                    assert k in snap, f"missing {k} in snapshot"
                assert snap["status"] == "searching"
            finally:
                await ws.close()

        asyncio.run(run())


# ---------- WebSocket location updates ----------
class TestWebSocketLocation:
    def test_location_updates_move_closer_to_pickup(self):
        b = _create_booking()
        pickup_lat, pickup_lng = b["pickup_lat"], b["pickup_lng"]

        def dist(la, lo):
            return ((la - pickup_lat) ** 2 + (lo - pickup_lng) ** 2) ** 0.5

        async def run():
            ws, _ = await _ws_connect(b["id"])
            try:
                msgs = await _collect(ws, n=4, timeout=10.0)
                assert msgs and msgs[0].get("type") == "snapshot"
                locs = [m for m in msgs if m.get("type") == "location"]
                assert len(locs) >= 2, f"expected >=2 location updates, got {len(locs)}: {msgs}"
                d0 = dist(msgs[0]["driver_lat"], msgs[0]["driver_lng"])
                d_last = dist(locs[-1]["driver_lat"], locs[-1]["driver_lng"])
                assert d_last < d0, f"driver did not move closer to pickup: {d0} -> {d_last}"
            finally:
                await ws.close()

        asyncio.run(run())


# ---------- WebSocket status broadcast on PATCH ----------
class TestWebSocketStatusBroadcast:
    def test_patch_status_broadcasts(self):
        b = _create_booking()

        async def run():
            ws, _ = await _ws_connect(b["id"])
            try:
                # consume snapshot
                await _collect(ws, n=1, timeout=4.0)
                # PATCH from a separate HTTP call
                r = requests.patch(f"{API}/bookings/{b['id']}/status",
                                   json={"status": "assigned"}, timeout=10)
                assert r.status_code == 200
                # collect several msgs to find status one
                msgs = await _collect(ws, n=6, timeout=6.0)
                status_msgs = [m for m in msgs if m.get("type") == "status"]
                assert status_msgs, f"no 'status' msg after PATCH: {msgs}"
                assert status_msgs[0].get("status") == "assigned"
            finally:
                await ws.close()

        asyncio.run(run())


# ---------- Snap to pickup / dropoff ----------
class TestSnapOnStatus:
    def test_picked_up_snaps_driver_to_pickup(self):
        b = _create_booking()
        r = requests.patch(f"{API}/bookings/{b['id']}/status",
                           json={"status": "picked_up"}, timeout=10)
        assert r.status_code == 200
        got = r.json()
        assert abs(got["driver_lat"] - got["pickup_lat"]) < 1e-6
        assert abs(got["driver_lng"] - got["pickup_lng"]) < 1e-6

    def test_delivered_snaps_driver_to_dropoff(self):
        b = _create_booking()
        # advance to picked_up first
        requests.patch(f"{API}/bookings/{b['id']}/status",
                       json={"status": "picked_up"}, timeout=10)
        r = requests.patch(f"{API}/bookings/{b['id']}/status",
                           json={"status": "delivered"}, timeout=10)
        assert r.status_code == 200
        got = r.json()
        assert abs(got["driver_lat"] - got["dropoff_lat"]) < 1e-6
        assert abs(got["driver_lng"] - got["dropoff_lng"]) < 1e-6


# ---------- Legacy resilience: simulator must not crash on missing coords ----------
class TestSimulatorLegacyResilience:
    def test_list_bookings_ok_with_legacy(self):
        # Just verify /api/bookings works — legacy-1 already seeded (from iter_5)
        r = requests.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
