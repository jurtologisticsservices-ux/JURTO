"""Backend API tests for ShiftLogistics booking app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vehicle-booking-app-21.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Vehicles ---
class TestVehicles:
    def test_vehicles_endpoint(self, s):
        r = s.get(f"{API}/vehicles", timeout=15)
        assert r.status_code == 200
        data = r.json()
        vs = data["vehicles"]
        assert len(vs) == 3
        rates = {v["id"]: v["rate"] for v in vs}
        assert rates == {"two_wheeler": 10, "tata_ace": 20, "bada_dost": 30}


# --- Maps autocomplete ---
class TestAutocomplete:
    def test_autocomplete_returns_suggestions(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "connaught place delhi"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "provider" in data
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) > 0
        first = data["suggestions"][0]
        assert "placeId" in first and "text" in first
        # store for reuse
        pytest.pickup_place_id = first["placeId"]
        pytest.pickup_text = first["text"]

    def test_autocomplete_second_location(self, s):
        r = s.get(f"{API}/maps/autocomplete", params={"q": "mumbai central"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data["suggestions"]) > 0
        pytest.drop_place_id = data["suggestions"][0]["placeId"]
        pytest.drop_text = data["suggestions"][0]["text"]


# --- Distance ---
class TestDistance:
    def test_distance_km(self, s):
        origin = getattr(pytest, "pickup_place_id", None)
        dest = getattr(pytest, "drop_place_id", None)
        assert origin and dest, "Need place IDs from previous test"
        r = s.get(f"{API}/maps/distance-km", params={"origin": origin, "destination": dest}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["distance_km"], (int, float))
        assert data["distance_km"] > 0
        assert "provider" in data
        pytest.distance_km = data["distance_km"]


# --- Bookings ---
class TestBookings:
    def test_create_booking_recalculates_fare(self, s):
        distance = getattr(pytest, "distance_km", 12.5)
        payload = {
            "name": "TEST_User",
            "phone": "9876543210",
            "vehicle_type": "tata_ace",
            "pickup_address": getattr(pytest, "pickup_text", "test pickup"),
            "dropoff_address": getattr(pytest, "drop_text", "test drop"),
            "distance_km": distance,
            "fare": 1.0,  # Wrong fare — server should recalc
        }
        r = s.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "confirmed"
        assert "id" in data and len(data["id"]) > 10
        # Server recalculates: distance * 20 (tata_ace)
        expected = round(distance * 20, 2)
        assert data["fare"] == expected, f"Server should recalc fare. Got {data['fare']}, expected {expected}"
        assert "_id" not in data
        pytest.booking_id = data["id"]

    def test_list_bookings_excludes_mongo_id(self, s):
        r = s.get(f"{API}/bookings", timeout=15)
        assert r.status_code == 200
        bookings = r.json()
        assert isinstance(bookings, list)
        assert len(bookings) > 0
        for b in bookings:
            assert "_id" not in b
            assert "id" in b
        # Verify our created booking is there
        ids = [b["id"] for b in bookings]
        assert getattr(pytest, "booking_id", None) in ids

    def test_invalid_vehicle_type_rejected(self, s):
        payload = {
            "name": "TEST_Bad", "phone": "9876543210", "vehicle_type": "hovercraft",
            "pickup_address": "a", "dropoff_address": "b", "distance_km": 5, "fare": 5,
        }
        r = s.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 400
