"""Backend tests for the new booking flow (sender/receiver/goods/payment + status)."""
import os
import re
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') if 'EXPO_PUBLIC_BACKEND_URL' in os.environ else None
# fall back to frontend/.env
if not BASE_URL:
    from pathlib import Path
    env = Path('/app/frontend/.env').read_text()
    for line in env.splitlines():
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
            break

API = f"{BASE_URL}/api"

DRIVER_NAMES = {
    "Ramesh Kumar", "Suresh Yadav", "Vijay Singh",
    "Anil Sharma", "Manoj Patel", "Prakash Reddy",
}

VEHICLE_PLATE_RE = re.compile(r"^[A-Z]{2} \d{2} [A-Z]{2} \d{4}$")


@pytest.fixture(scope="module")
def created_booking():
    payload = {
        "vehicle_type": "tata_ace",
        "pickup_address": "TEST_Pickup Address",
        "dropoff_address": "TEST_Dropoff Address",
        "distance_km": 5.0,
        "fare": 999.0,  # server should ignore this
        "sender_phone": "9876543210",
        "receiver_name": "TEST_John Doe",
        "receiver_phone": "9123456789",
        "goods_note": "TEST_5 Furniture Boxes",
        "payment_method": "cash_pickup",
    }
    r = requests.post(f"{API}/bookings", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- POST /api/bookings (new payload) ----------
class TestCreateBooking:
    def test_create_returns_expected_fields(self, created_booking):
        b = created_booking
        for key in [
            "id", "vehicle_type", "vehicle_name", "pickup_address", "dropoff_address",
            "distance_km", "fare", "sender_phone", "receiver_name", "receiver_phone",
            "goods_note", "payment_method", "driver_name", "driver_phone",
            "vehicle_number", "status", "created_at", "updated_at",
        ]:
            assert key in b, f"missing field: {key}"

    def test_server_recalculates_fare(self, created_booking):
        # tata_ace × 5 km → 100.00 (server ignores client fare=999)
        assert created_booking["fare"] == 100.0
        assert created_booking["vehicle_name"] == "TATA ACE"

    def test_status_is_searching(self, created_booking):
        assert created_booking["status"] == "searching"

    def test_driver_name_from_list(self, created_booking):
        assert created_booking["driver_name"] in DRIVER_NAMES
        assert created_booking["driver_phone"].startswith("+91")

    def test_vehicle_number_format(self, created_booking):
        # e.g. "TN 01 AB 1234"
        assert VEHICLE_PLATE_RE.match(created_booking["vehicle_number"]), created_booking["vehicle_number"]

    def test_no_mongo_id_leak(self, created_booking):
        assert "_id" not in created_booking

    def test_rejects_invalid_payment_method(self):
        payload = {
            "vehicle_type": "tata_ace",
            "pickup_address": "A", "dropoff_address": "B",
            "distance_km": 5.0, "fare": 0.0,
            "sender_phone": "9876543210",
            "receiver_name": "TEST_John",
            "receiver_phone": "9123456789",
            "goods_note": "x",
            "payment_method": "bitcoin",  # invalid
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 422, r.text

    def test_rejects_invalid_vehicle_type(self):
        payload = {
            "vehicle_type": "spaceship",
            "pickup_address": "A", "dropoff_address": "B",
            "distance_km": 5.0, "fare": 0.0,
            "sender_phone": "9876543210",
            "receiver_name": "TEST_John",
            "receiver_phone": "9123456789",
            "goods_note": "x",
            "payment_method": "upi",
        }
        r = requests.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 400


# ---------- GET /api/bookings/{id} ----------
class TestGetBooking:
    def test_returns_booking(self, created_booking):
        r = requests.get(f"{API}/bookings/{created_booking['id']}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == created_booking["id"]
        assert "_id" not in data
        assert data["fare"] == 100.0

    def test_404_for_unknown(self):
        r = requests.get(f"{API}/bookings/nonexistent-uuid", timeout=15)
        assert r.status_code == 404


# ---------- PATCH /api/bookings/{id}/status ----------
class TestStatusUpdate:
    def test_progress_status(self, created_booking):
        bid = created_booking["id"]
        for s in ["assigned", "picked_up", "delivered"]:
            r = requests.patch(f"{API}/bookings/{bid}/status", json={"status": s}, timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == s
        # verify persistence via GET
        r = requests.get(f"{API}/bookings/{bid}", timeout=15)
        assert r.json()["status"] == "delivered"

    def test_reject_invalid_status(self, created_booking):
        r = requests.patch(
            f"{API}/bookings/{created_booking['id']}/status",
            json={"status": "flying"}, timeout=15,
        )
        assert r.status_code == 422

    def test_404_unknown_booking(self):
        r = requests.patch(
            f"{API}/bookings/nonexistent-uuid/status",
            json={"status": "assigned"}, timeout=15,
        )
        assert r.status_code == 404


# ---------- GET /api/bookings ----------
class TestListBookings:
    def test_list_excludes_id_and_sorted(self, created_booking):
        r = requests.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert all("_id" not in b for b in items)
        ids = [b["id"] for b in items]
        assert created_booking["id"] in ids
        # created_at desc
        dates = [b["created_at"] for b in items]
        assert dates == sorted(dates, reverse=True)


# ---------- Legacy resilience regression ----------
class TestLegacyBooking:
    """Regression for iter-4 bug: GET /api/bookings must not 500 when the DB
    contains legacy documents that lack the new required fields."""

    def test_legacy_doc_returned_with_defaults(self, created_booking):
        r = requests.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
        items = r.json()
        legacy = [b for b in items if b["id"] == "legacy-1"]
        # legacy-1 is inserted out-of-band before the test suite runs
        if not legacy:
            pytest.skip("legacy-1 not seeded; run scripts/insert_legacy.py")
        b = legacy[0]
        # Legacy defaults applied
        assert b["sender_phone"] == ""
        assert b["receiver_name"] == ""
        assert b["receiver_phone"] == ""
        assert b["goods_note"] == ""
        assert b["payment_method"] == "cash_pickup"
        assert b["driver_name"] == ""
        assert b["vehicle_number"] == ""
        assert b["vehicle_name"] == ""
        assert b["status"] == "searching"


# ---------- Google Maps (still working) ----------
class TestGoogleMaps:
    def test_autocomplete_real_address(self):
        r = requests.get(f"{API}/maps/autocomplete", params={"q": "connaught place delhi"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("provider") == "google"
        assert len(data.get("suggestions", [])) > 0
