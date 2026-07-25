"""Backend API tests for ShiftLogistics booking app.

Google Maps API key currently has API restrictions (Places API New + Distance Matrix
blocked) → those endpoints are expected to return HTTP 4xx with a user-friendly
error detail message. NO OSM fallback should exist.
"""
import os
import re
import pytest
import requests
from pathlib import Path


def _load_backend_url() -> str:
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Verify no OSM/Nominatim/Haversine references remain in backend source ---
class TestNoOSMFallback:
    def test_server_py_has_no_osm_refs(self):
        with open("/app/backend/server.py", "r") as f:
            src = f.read().lower()
        for banned in ("nominatim", "openstreetmap", "haversine", "osm"):
            assert banned not in src, f"'{banned}' still present in server.py"


# --- Health ---
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "operational"


# --- Vehicles ---
class TestVehicles:
    def test_vehicles_endpoint(self, s):
        r = s.get(f"{API}/vehicles", timeout=15)
        assert r.status_code == 200
        vs = r.json()["vehicles"]
        assert len(vs) == 3
        rates = {v["id"]: v["rate"] for v in vs}
        assert rates == {"two_wheeler": 10, "tata_ace": 20, "bada_dost": 30}


FRIENDLY_KEYWORDS = re.compile(
    r"(not authorized|unauthorized|invalid|quota|unavailable|unable to reach|"
    r"enable the api|please try again|no route found|check the pickup)",
    re.IGNORECASE,
)


# --- Maps autocomplete (expected to 4xx due to API restriction) ---
class TestAutocompleteFriendlyError:
    def test_autocomplete_returns_friendly_error_no_osm_fallback(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "connaught place delhi"}, timeout=20)
        # With API restrictions we expect a 4xx (typically 403). If the user unlocks
        # the key later, a 200 would also be valid → then we'd expect provider=google.
        if r.status_code == 200:
            data = r.json()
            assert data.get("provider") == "google", "Must be google (no OSM fallback)"
            assert "suggestions" in data
            return

        assert 400 <= r.status_code < 600, f"Unexpected status: {r.status_code}"
        data = r.json()
        detail = data.get("detail", "")
        assert isinstance(detail, str) and len(detail) > 0, "detail must be a non-empty string"
        # Must NOT be a raw Google JSON dump
        assert not detail.strip().startswith("{"), f"detail looks like raw JSON: {detail[:120]}"
        assert FRIENDLY_KEYWORDS.search(detail), f"detail not user-friendly: {detail}"


# --- Distance (expected to 4xx due to API restriction) ---
class TestDistanceFriendlyError:
    def test_distance_km_returns_friendly_error_no_osm_fallback(self, s):
        r = s.get(
            f"{API}/maps/distance-km",
            params={"origin": "Connaught Place, Delhi", "destination": "India Gate, Delhi"},
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            assert data.get("provider") == "google"
            assert isinstance(data["distance_km"], (int, float))
            return

        assert 400 <= r.status_code < 600
        detail = r.json().get("detail", "")
        assert isinstance(detail, str) and len(detail) > 0
        assert not detail.strip().startswith("{"), f"raw JSON leaked: {detail[:120]}"
        assert FRIENDLY_KEYWORDS.search(detail), f"detail not user-friendly: {detail}"


# --- Bookings (no Google dependency) ---
class TestBookings:
    def test_create_booking_recalculates_fare_tata_ace(self, s):
        payload = {
            "name": "TEST_User",
            "phone": "9876543210",
            "vehicle_type": "tata_ace",
            "pickup_address": "TEST pickup addr",
            "dropoff_address": "TEST drop addr",
            "distance_km": 5.0,
            "fare": 999.0,  # wrong — server should ignore & recalc
        }
        r = s.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "confirmed"
        assert data["fare"] == 100.00, f"5 km * ₹20 = 100. Got {data['fare']}"
        assert "_id" not in data
        assert len(data["id"]) > 10
        pytest.booking_id = data["id"]

    def test_create_booking_two_wheeler(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Two", "phone": "9876543210", "vehicle_type": "two_wheeler",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 3.5, "fare": 0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["fare"] == 35.0  # 3.5 * 10

    def test_create_booking_bada_dost(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Bd", "phone": "9876543210", "vehicle_type": "bada_dost",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 2.0, "fare": 0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["fare"] == 60.0  # 2 * 30

    def test_invalid_vehicle_type_rejected(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Bad", "phone": "9876543210", "vehicle_type": "hovercraft",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 5, "fare": 5,
        }, timeout=15)
        assert r.status_code == 400

    def test_list_bookings_excludes_mongo_id(self, s):
        r = s.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
        bookings = r.json()
        assert isinstance(bookings, list) and len(bookings) > 0
        for b in bookings:
            assert "_id" not in b
            assert "id" in b
        ids = [b["id"] for b in bookings]
        assert getattr(pytest, "booking_id", None) in ids
