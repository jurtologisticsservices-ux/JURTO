"""
LuxeLogistics backend test suite.
Covers: Auth (send-otp, verify-otp, me), Vehicles, Maps distance-multi,
Orders (per-user), Notifications, Addresses, and WebSockets (tracking, notifications).
"""
import os
import json
import time
import random
import asyncio
from urllib.parse import urlparse

import pytest
import requests
import websockets

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
WS_BASE = "wss://" + urlparse(BASE_URL).netloc


def _rand_phone() -> str:
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(9))


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def user_a():
    phone = _rand_phone()
    r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": "123456", "name": "TEST_UserA"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"phone": phone, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def user_b():
    phone = _rand_phone()
    requests.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone})
    r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": "654321", "name": "TEST_UserB"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"phone": phone, "token": data["token"], "user": data["user"]}


def _hdr(u):
    return {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}


# ================== AUTH ==================
class TestAuth:
    def test_send_otp_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": "9876543210"})
        assert r.status_code == 200
        j = r.json()
        assert j.get("ok") is True and j.get("mode") == "mock"

    def test_verify_otp_rejects_short_otp(self):
        r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9876543210", "otp": "123"})
        assert r.status_code == 400

    def test_verify_otp_creates_and_returns_token(self):
        phone = _rand_phone()
        r = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": "111111", "name": "TEST_New"})
        assert r.status_code == 200
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["phone"].endswith(phone)

    def test_me_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert r.status_code == 401

    def test_me_returns_current_user(self, user_a):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(user_a))
        assert r.status_code == 200
        assert r.json()["id"] == user_a["user"]["id"]

    def test_patch_me_updates_profile(self, user_a):
        r = requests.patch(f"{BASE_URL}/api/auth/me",
                           headers=_hdr(user_a),
                           json={"name": "TEST_UserA_Updated", "gst_number": "29ABCDE1234F1Z5", "gst_business_name": "TEST Biz"})
        assert r.status_code == 200
        j = r.json()
        assert j["name"] == "TEST_UserA_Updated"
        assert j["gst_number"] == "29ABCDE1234F1Z5"
        # persist check
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(user_a))
        assert r2.json()["gst_number"] == "29ABCDE1234F1Z5"


# ================== VEHICLES ==================
class TestVehicles:
    def test_list_9_vehicles_in_order(self):
        r = requests.get(f"{BASE_URL}/api/vehicles")
        assert r.status_code == 200
        vs = r.json()["vehicles"]
        assert len(vs) == 9
        assert vs[0]["name"] == "Two-Wheeler"
        assert vs[-1]["name"] == "17ft Truck"
        # ascending capacity
        caps = [v["capacity_kg"] for v in vs]
        assert caps == sorted(caps)
        for v in vs:
            assert "rate" in v and "capacity_kg" in v


# ================== MAPS ==================
class TestMaps:
    def test_distance_multi_three_stops(self):
        # Real Chennai place IDs (Central, Marina Beach, T. Nagar)
        payload = {"stops": ["Chennai Central, Chennai", "Marina Beach, Chennai", "T. Nagar, Chennai"]}
        r = requests.post(f"{BASE_URL}/api/maps/distance-multi", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j["distance_km"], (int, float))
        assert j["distance_km"] > 0
        assert j["hops"] == 2


# ================== ORDERS + PER-USER SCOPING ==================
class TestOrders:
    def test_create_order_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/orders", json={})
        assert r.status_code == 401

    def test_create_and_scope(self, user_a, user_b):
        stops = [
            {"address": "Chennai Central, Chennai", "lat": 13.0827, "lng": 80.2707},
            {"address": "Marina Beach, Chennai", "lat": 13.0500, "lng": 80.2824},
        ]
        payload = {
            "vehicle_type": "tata_ace",
            "stops": stops,
            "distance_km": 5.0,
            "payment_method": "cash_pickup",
            "receiver_name": "TEST_Receiver",
            "receiver_phone": "9998887777",
            "goods_note": "TEST goods",
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_hdr(user_a), json=payload)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["user_id"] == user_a["user"]["id"]
        assert order["vehicle_name"] == "Tata Ace"
        assert order["driver_name"] and order["vehicle_number"]
        assert order["status"] == "searching"
        # fare = 5 * 22 = 110
        assert abs(order["fare"] - 110.0) < 0.01
        pytest.order_a_id = order["id"]

        # Create one for user_b too
        rb = requests.post(f"{BASE_URL}/api/orders", headers=_hdr(user_b), json=payload)
        assert rb.status_code == 200
        pytest.order_b_id = rb.json()["id"]

        # Per-user list scoping
        la = requests.get(f"{BASE_URL}/api/orders", headers=_hdr(user_a)).json()
        lb = requests.get(f"{BASE_URL}/api/orders", headers=_hdr(user_b)).json()
        ids_a = {o["id"] for o in la}
        ids_b = {o["id"] for o in lb}
        assert pytest.order_a_id in ids_a and pytest.order_a_id not in ids_b
        assert pytest.order_b_id in ids_b and pytest.order_b_id not in ids_a

    def test_get_order_404_for_other_user(self, user_a, user_b):
        r = requests.get(f"{BASE_URL}/api/orders/{pytest.order_b_id}", headers=_hdr(user_a))
        assert r.status_code == 404

    def test_patch_status_and_notification_emitted(self, user_a):
        r = requests.patch(f"{BASE_URL}/api/orders/{pytest.order_a_id}/status",
                           headers=_hdr(user_a), json={"status": "assigned"})
        assert r.status_code == 200
        assert r.json()["status"] == "assigned"
        # notification appeared
        n = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(user_a)).json()
        types = [x["type"] for x in n]
        assert "STATUS_ASSIGNED" in types

    def test_notifications_scoped(self, user_a, user_b):
        na = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(user_a)).json()
        nb = requests.get(f"{BASE_URL}/api/notifications", headers=_hdr(user_b)).json()
        oa = {x["order_id"] for x in na}
        ob = {x["order_id"] for x in nb}
        assert pytest.order_a_id not in ob
        assert pytest.order_b_id not in oa


# ================== ADDRESSES ==================
class TestAddresses:
    def test_addresses_crud_scoped(self, user_a, user_b):
        r = requests.post(f"{BASE_URL}/api/addresses", headers=_hdr(user_a),
                          json={"label": "TEST_Home", "address": "1 TEST St, Chennai"})
        assert r.status_code == 200
        aid = r.json()["id"]
        la = requests.get(f"{BASE_URL}/api/addresses", headers=_hdr(user_a)).json()
        assert any(a["id"] == aid for a in la)
        lb = requests.get(f"{BASE_URL}/api/addresses", headers=_hdr(user_b)).json()
        assert not any(a["id"] == aid for a in lb)
        # user_b can't delete user_a address
        rd = requests.delete(f"{BASE_URL}/api/addresses/{aid}", headers=_hdr(user_b))
        assert rd.json()["deleted"] == 0
        rd = requests.delete(f"{BASE_URL}/api/addresses/{aid}", headers=_hdr(user_a))
        assert rd.json()["deleted"] == 1


# ================== WEBSOCKETS ==================
class TestWebSockets:
    @pytest.mark.asyncio
    async def test_tracking_ws_rejects_missing_token(self):
        url = f"{WS_BASE}/api/ws/tracking/fake-order"
        with pytest.raises(Exception):
            async with websockets.connect(url) as ws:
                await asyncio.wait_for(ws.recv(), timeout=3)

    @pytest.mark.asyncio
    async def test_tracking_ws_snapshot_and_location(self, user_a):
        # ensure order exists and status active
        oid = pytest.order_a_id
        url = f"{WS_BASE}/api/ws/tracking/{oid}?token={user_a['token']}"
        async with websockets.connect(url) as ws:
            snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            assert snap["type"] == "snapshot"
            # wait for at least one location tick (sim runs every 2s)
            got_loc = False
            end = time.time() + 6
            while time.time() < end:
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                    if msg.get("type") == "location":
                        got_loc = True
                        break
                except asyncio.TimeoutError:
                    break
            assert got_loc, "No location tick received in 6s"

    @pytest.mark.asyncio
    async def test_notifications_ws_rejects_missing_token(self):
        url = f"{WS_BASE}/api/ws/notifications"
        with pytest.raises(Exception):
            async with websockets.connect(url) as ws:
                await asyncio.wait_for(ws.recv(), timeout=3)

    @pytest.mark.asyncio
    async def test_notifications_ws_scoped(self, user_a, user_b):
        # Connect user_a ws, then update user_a order status -> user_a should get event.
        url_a = f"{WS_BASE}/api/ws/notifications?token={user_a['token']}"
        async with websockets.connect(url_a) as ws_a:
            # trigger via patch status on user_a's own order
            r = requests.patch(f"{BASE_URL}/api/orders/{pytest.order_a_id}/status",
                               headers=_hdr(user_a), json={"status": "picked_up"})
            assert r.status_code == 200
            got = False
            end = time.time() + 5
            while time.time() < end:
                try:
                    msg = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=3))
                    if msg.get("event") == "notification" and msg.get("order_id") == pytest.order_a_id:
                        got = True
                        break
                except asyncio.TimeoutError:
                    break
            assert got, "user_a did not receive its own notification event"
