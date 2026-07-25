"""Backend API tests for ShiftLogistics — HAPPY PATH.

User has enabled Places API (New), Geocoding API, and Distance Matrix API and
set application restrictions to 'None'. Backend should now return REAL Google
Maps data with provider='google'.
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


# --- No-fallback source guarantee ---
class TestNoOSMFallback:
    def test_server_py_has_no_osm_refs(self):
        with open("/app/backend/server.py", "r") as f:
            src = f.read().lower()
        for banned in ("nominatim", "openstreetmap", "haversine"):
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


# --- Autocomplete (Google Places New) — HAPPY PATH ---
class TestAutocompleteLive:
    def test_autocomplete_connaught_place(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "connaught place delhi"}, timeout=25)
        assert r.status_code == 200, f"Expected 200 (Google unlocked). Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("provider") == "google", f"provider must be 'google', got: {data.get('provider')}"
        suggs = data.get("suggestions", [])
        assert isinstance(suggs, list) and len(suggs) > 0, "expected non-empty suggestions"
        # Google placeIds typically start with ChIJ or Eh
        first = suggs[0]
        assert first["placeId"], "placeId must be non-empty"
        assert re.match(r"^(ChIJ|Eh|Gh|El|Ei)", first["placeId"]), (
            f"placeId '{first['placeId']}' does not look like a Google Place ID"
        )
        assert first["text"], "text must be non-empty"
        # Verify at least one suggestion mentions Connaught or Delhi
        blob = " ".join(x["text"].lower() for x in suggs)
        assert "connaught" in blob or "delhi" in blob, f"suggestions do not mention query: {blob[:200]}"
        # Stash a placeId for cross-test reuse
        pytest.pickup_place_id = first["placeId"]

    def test_autocomplete_mumbai_central(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "mumbai central"}, timeout=25)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("provider") == "google"
        suggs = data.get("suggestions", [])
        assert len(suggs) > 0
        assert all(x.get("placeId") for x in suggs), "every suggestion must have a placeId"
        blob = " ".join(x["text"].lower() for x in suggs)
        assert "mumbai" in blob, f"suggestions do not mention mumbai: {blob[:200]}"

    def test_autocomplete_india_gate(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "india gate delhi"}, timeout=25)
        assert r.status_code == 200
        data = r.json()
        assert data.get("provider") == "google"
        suggs = data.get("suggestions", [])
        assert len(suggs) > 0
        pytest.dropoff_place_id = suggs[0]["placeId"]


# --- Distance Matrix — HAPPY PATH ---
class TestDistanceLive:
    def test_distance_mumbai_pune_by_name(self, s):
        r = s.get(f"{API}/maps/distance-km",
                  params={"origin": "Mumbai", "destination": "Pune"}, timeout=25)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data["provider"] == "google"
        km = data["distance_km"]
        assert isinstance(km, (int, float))
        # Mumbai→Pune road distance ~ 140-170 km
        assert 130 <= km <= 180, f"Mumbai-Pune distance {km} km not in [130,180]"
        assert data.get("duration_text"), "duration_text must be populated"
        # Duration should mention hour or minute
        dur = data["duration_text"].lower()
        assert "hour" in dur or "min" in dur, f"duration text unexpected: {dur}"

    def test_distance_with_real_placeids(self, s):
        pu = getattr(pytest, "pickup_place_id", None)
        dr = getattr(pytest, "dropoff_place_id", None)
        if not pu or not dr:
            pytest.skip("placeIds not available from autocomplete tests")
        r = s.get(f"{API}/maps/distance-km",
                  params={"origin": pu, "destination": dr}, timeout=25)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data["provider"] == "google"
        assert isinstance(data["distance_km"], (int, float))
        assert data["distance_km"] > 0
        assert data.get("duration_text")


# --- Bookings ---
class TestBookings:
    def test_create_booking_recalculates_fare_tata_ace(self, s):
        # This is the exact case mentioned in the task: distance_km=10, tata_ace → ₹200
        payload = {
            "name": "TEST_User",
            "phone": "9876543210",
            "vehicle_type": "tata_ace",
            "pickup_address": "TEST pickup addr",
            "dropoff_address": "TEST drop addr",
            "distance_km": 10.0,
            "fare": 999.0,  # wrong — server should ignore & recalc
        }
        r = s.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "confirmed"
        assert data["fare"] == 200.00, f"10 km * ₹20 = 200. Got {data['fare']}"
        assert "_id" not in data
        assert len(data["id"]) > 10
        pytest.booking_id = data["id"]

    def test_create_booking_two_wheeler(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Two", "phone": "9876543210", "vehicle_type": "two_wheeler",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 3.5, "fare": 0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["fare"] == 35.0

    def test_create_booking_bada_dost(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Bd", "phone": "9876543210", "vehicle_type": "bada_dost",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 2.0, "fare": 0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["fare"] == 60.0

    def test_invalid_vehicle_type_rejected(self, s):
        r = s.post(f"{API}/bookings", json={
            "name": "TEST_Bad", "phone": "9876543210", "vehicle_type": "hovercraft",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 5, "fare": 5,
        }, timeout=15)
        assert r.status_code == 400

    def test_list_bookings_shows_new_booking(self, s):
        r = s.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
        bookings = r.json()
        assert isinstance(bookings, list) and len(bookings) > 0
        for b in bookings:
            assert "_id" not in b
            assert "id" in b
        ids = [b["id"] for b in bookings]
        assert getattr(pytest, "booking_id", None) in ids
