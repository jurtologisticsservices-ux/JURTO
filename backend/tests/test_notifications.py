"""Tests for the new Notifications & Alerts system.

Covers:
- Booking creation emits BOOKING_CONFIRMED notification
- PATCH status emits STATUS_ASSIGNED / STATUS_PICKED_UP / STATUS_DELIVERED
- GET /api/notifications sorted desc, no _id
- POST /api/notifications/read-all
- DELETE /api/notifications
- WebSocket /api/ws/notifications delivers real-time events
"""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "https://vehicle-booking-app-21.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


@pytest.fixture(scope="module", autouse=True)
def clean_notifs():
    # Clean before and after the module runs
    requests.delete(f"{API}/notifications", timeout=15)
    yield
    requests.delete(f"{API}/notifications", timeout=15)


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Helpers ----------
def _create_booking(api_client, vehicle_type="tata_ace"):
    payload = {
        "vehicle_type": vehicle_type,
        "pickup_address": "Andheri West, Mumbai, Maharashtra, India",
        "dropoff_address": "Bandra West, Mumbai, Maharashtra, India",
        "distance_km": 8.5,
        "fare": 170.0,
        "sender_phone": "+919999900001",
        "receiver_name": "TEST Receiver",
        "receiver_phone": "+919999900002",
        "goods_note": "TEST notif " + str(uuid.uuid4())[:6],
        "payment_method": "cash_pickup",
    }
    r = api_client.post(f"{API}/bookings", json=payload, timeout=30)
    assert r.status_code == 200, f"create booking failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Basic REST ----------
class TestNotificationsRest:
    def test_delete_clears_collection(self, api_client):
        r = api_client.delete(f"{API}/notifications", timeout=15)
        assert r.status_code == 200
        assert "deleted" in r.json()
        # verify list is now empty
        lst = api_client.get(f"{API}/notifications", timeout=15).json()
        assert isinstance(lst, list)
        assert lst == []

    def test_booking_creation_emits_booking_confirmed(self, api_client):
        # Ensure clean state
        api_client.delete(f"{API}/notifications", timeout=15)
        booking = _create_booking(api_client)
        # small wait for insert
        time.sleep(0.5)
        r = api_client.get(f"{API}/notifications", timeout=15)
        assert r.status_code == 200
        notifs = r.json()
        assert len(notifs) >= 1, "no notifications after booking create"
        first = notifs[0]
        # No mongo _id
        assert "_id" not in first
        assert first["type"] == "BOOKING_CONFIRMED"
        assert first["title"] == "Booking Confirmed"
        assert first["booking_id"] == booking["id"]
        assert first["read"] is False
        assert booking["vehicle_name"] in first["body"]

    def test_notifications_sorted_desc(self, api_client):
        api_client.delete(f"{API}/notifications", timeout=15)
        _create_booking(api_client)
        time.sleep(0.2)
        _create_booking(api_client, vehicle_type="two_wheeler")
        time.sleep(0.5)
        notifs = api_client.get(f"{API}/notifications", timeout=15).json()
        assert len(notifs) >= 2
        assert notifs[0]["created_at"] >= notifs[1]["created_at"]

    def test_status_updates_emit_notifications(self, api_client):
        api_client.delete(f"{API}/notifications", timeout=15)
        booking = _create_booking(api_client)
        bid = booking["id"]
        for status, exp_type in [
            ("assigned", "STATUS_ASSIGNED"),
            ("picked_up", "STATUS_PICKED_UP"),
            ("delivered", "STATUS_DELIVERED"),
        ]:
            r = api_client.patch(
                f"{API}/bookings/{bid}/status", json={"status": status}, timeout=15
            )
            assert r.status_code == 200, f"patch {status} failed: {r.text}"
        time.sleep(0.5)
        notifs = api_client.get(f"{API}/notifications", timeout=15).json()
        types = [n["type"] for n in notifs]
        assert "STATUS_ASSIGNED" in types
        assert "STATUS_PICKED_UP" in types
        assert "STATUS_DELIVERED" in types
        # STATUS_ASSIGNED must carry driver_name and vehicle_number in body
        assigned = next(n for n in notifs if n["type"] == "STATUS_ASSIGNED")
        assert booking["driver_name"] in assigned["body"]
        assert booking["vehicle_number"] in assigned["body"]

    def test_read_all_marks_all_read(self, api_client):
        # Ensure at least one unread exists
        _create_booking(api_client)
        time.sleep(0.3)
        r = api_client.post(f"{API}/notifications/read-all", timeout=15)
        assert r.status_code == 200
        time.sleep(0.2)
        notifs = api_client.get(f"{API}/notifications", timeout=15).json()
        assert all(n["read"] is True for n in notifs)


# ---------- WebSocket ----------
class TestNotificationsWebSocket:
    def test_ws_receives_notification_on_status_patch(self, api_client):
        """
        Connect to /api/ws/notifications, then create + patch a booking; verify
        the websocket receives event=notification messages.
        """

        async def run():
            uri = f"{WS_BASE}/api/ws/notifications"
            received = []
            async with websockets.connect(uri, open_timeout=10) as ws:
                # Give server a moment to register the connection
                await asyncio.sleep(0.5)

                # Trigger events from a background task so we can concurrently read.
                async def trigger():
                    # slight delay so recv is already running
                    await asyncio.sleep(0.2)
                    booking = _create_booking(api_client)
                    await asyncio.sleep(0.3)
                    api_client.patch(
                        f"{API}/bookings/{booking['id']}/status",
                        json={"status": "assigned"},
                        timeout=15,
                    )
                    return booking

                trig = asyncio.create_task(trigger())

                # Collect messages for a few seconds
                deadline = asyncio.get_event_loop().time() + 8
                while asyncio.get_event_loop().time() < deadline and len(received) < 2:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2)
                        try:
                            data = json.loads(msg)
                            if data.get("event") == "notification":
                                received.append(data)
                        except Exception:
                            pass
                    except asyncio.TimeoutError:
                        continue
                await trig
            return received

        received = asyncio.run(run())
        assert len(received) >= 2, f"expected 2 notif events, got {len(received)}: {received}"
        types = [n.get("type") for n in received]
        assert "BOOKING_CONFIRMED" in types
        assert "STATUS_ASSIGNED" in types
