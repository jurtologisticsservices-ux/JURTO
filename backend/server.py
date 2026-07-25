from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

VEHICLE_RATES = {
    "two_wheeler": 10,
    "tata_ace": 20,
    "bada_dost": 30,
}

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Suggestion(BaseModel):
    placeId: str
    text: str


class AutocompleteResponse(BaseModel):
    suggestions: List[Suggestion]
    provider: str


class DistanceResponse(BaseModel):
    distance_km: float
    distance_text: str
    duration_text: Optional[str] = None
    provider: str


class BookingCreate(BaseModel):
    name: str
    phone: str
    vehicle_type: str
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    vehicle_type: str
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float
    status: str = "confirmed"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Helpers ----------
async def _google_autocomplete(q: str) -> Optional[List[dict]]:
    if not GOOGLE_MAPS_API_KEY:
        return None
    body = {"input": q, "includeQueryPredictions": False}
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(
                "https://places.googleapis.com/v1/places:autocomplete",
                json=body,
                headers=headers,
            )
        if r.status_code != 200:
            logger.warning(f"Google Places disabled/failed ({r.status_code}); falling back")
            return None
        data = r.json()
        out = []
        for s in data.get("suggestions", []):
            p = s.get("placePrediction")
            if p:
                out.append({
                    "placeId": p.get("placeId", ""),
                    "text": (p.get("text") or {}).get("text", ""),
                })
        return out
    except Exception as e:
        logger.warning(f"Google autocomplete error: {e}")
        return None


async def _nominatim_search(q: str) -> List[dict]:
    """Fallback autocomplete via OpenStreetMap Nominatim."""
    params = {"q": q, "format": "json", "addressdetails": 0, "limit": 6}
    headers = {"User-Agent": "ShiftLogistics/1.0"}
    async with httpx.AsyncClient(timeout=10) as hc:
        r = await hc.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
    if r.status_code != 200:
        return []
    out = []
    for item in r.json():
        # Use lat,lon as placeId so distance endpoint can use it directly
        lat = item.get("lat")
        lon = item.get("lon")
        if lat and lon:
            out.append({
                "placeId": f"osm:{lat},{lon}",
                "text": item.get("display_name", ""),
            })
    return out


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def _google_distance(origin: str, destination: str) -> Optional[dict]:
    if not GOOGLE_MAPS_API_KEY:
        return None

    def _fmt(val: str) -> str:
        if val.startswith("osm:"):
            return None  # Signal to skip google
        if val.startswith("place_id:") or "," in val:
            return val
        if " " not in val and len(val) > 20:
            return f"place_id:{val}"
        return val

    o, d = _fmt(origin), _fmt(destination)
    if o is None or d is None:
        return None

    params = {"origins": o, "destinations": d, "units": "metric", "key": GOOGLE_MAPS_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get("https://maps.googleapis.com/maps/api/distancematrix/json", params=params)
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("status") != "OK":
            return None
        element = data["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            return None
        km = round(element["distance"]["value"] / 1000, 2)
        return {
            "distance_km": km,
            "distance_text": element["distance"].get("text", f"{km} km"),
            "duration_text": (element.get("duration") or {}).get("text"),
        }
    except Exception as e:
        logger.warning(f"Google distance error: {e}")
        return None


async def _resolve_to_latlon(value: str) -> Optional[tuple]:
    """Convert placeId/osm/address to (lat, lon)."""
    if value.startswith("osm:"):
        try:
            lat, lon = value[4:].split(",")
            return float(lat), float(lon)
        except Exception:
            return None
    # Geocode via Nominatim
    params = {"q": value, "format": "json", "limit": 1}
    headers = {"User-Agent": "ShiftLogistics/1.0"}
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
        if r.status_code != 200:
            return None
        items = r.json()
        if not items:
            return None
        return float(items[0]["lat"]), float(items[0]["lon"])
    except Exception:
        return None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "ShiftLogistics API", "status": "operational"}


@api_router.get("/vehicles")
async def vehicles():
    return {
        "vehicles": [
            {"id": "two_wheeler", "name": "TWO-WHEELER", "rate": 10, "capacity": "20 KG"},
            {"id": "tata_ace", "name": "TATA ACE", "rate": 20, "capacity": "750 KG"},
            {"id": "bada_dost", "name": "BADA DOST", "rate": 30, "capacity": "1500 KG"},
        ]
    }


@api_router.get("/maps/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(q: str = Query(..., min_length=2)):
    google = await _google_autocomplete(q)
    if google is not None:
        return {"suggestions": google, "provider": "google"}
    osm = await _nominatim_search(q)
    return {"suggestions": osm, "provider": "osm"}


@api_router.get("/maps/distance-km", response_model=DistanceResponse)
async def distance_km(origin: str, destination: str):
    google = await _google_distance(origin, destination)
    if google is not None:
        return {**google, "provider": "google"}

    # Fallback: Haversine via Nominatim
    o = await _resolve_to_latlon(origin)
    d = await _resolve_to_latlon(destination)
    if not o or not d:
        raise HTTPException(status_code=400, detail="Could not geocode one or both addresses")
    km = round(_haversine_km(o[0], o[1], d[0], d[1]), 2)
    return {
        "distance_km": km,
        "distance_text": f"{km} km",
        "duration_text": None,
        "provider": "osm",
    }


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    if payload.vehicle_type not in VEHICLE_RATES:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")
    fare = round(payload.distance_km * VEHICLE_RATES[payload.vehicle_type], 2)
    booking = Booking(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        vehicle_type=payload.vehicle_type,
        pickup_address=payload.pickup_address,
        dropoff_address=payload.dropoff_address,
        distance_km=payload.distance_km,
        fare=fare,
    )
    await db.bookings.insert_one(booking.model_dump())
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings():
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Booking(**d) for d in docs]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
