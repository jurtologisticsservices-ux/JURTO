from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ['GOOGLE_MAPS_API_KEY']

VEHICLE_RATES = {"two_wheeler": 10, "tata_ace": 20, "bada_dost": 30}
VEHICLE_NAMES = {"two_wheeler": "TWO-WHEELER", "tata_ace": "TATA ACE", "bada_dost": "BADA DOST"}

DRIVERS = [
    {"name": "Ramesh Kumar", "phone": "+919876543210"},
    {"name": "Suresh Yadav", "phone": "+919123456780"},
    {"name": "Vijay Singh", "phone": "+919812345678"},
    {"name": "Anil Sharma", "phone": "+919845123456"},
    {"name": "Manoj Patel", "phone": "+919765432109"},
    {"name": "Prakash Reddy", "phone": "+919887654321"},
]
STATE_CODES = ["TN", "KA", "MH", "DL", "UP", "GJ", "RJ", "TS", "AP", "KL"]

STATUS_ORDER: List[str] = ["searching", "assigned", "picked_up", "delivered"]
StatusLiteral = Literal["searching", "assigned", "picked_up", "delivered", "cancelled"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Suggestion(BaseModel):
    placeId: str
    text: str


class AutocompleteResponse(BaseModel):
    suggestions: List[Suggestion]
    provider: str = "google"


class DistanceResponse(BaseModel):
    distance_km: float
    distance_text: str
    duration_text: Optional[str] = None
    provider: str = "google"


class BookingCreate(BaseModel):
    # Route + vehicle
    vehicle_type: str
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float
    # Contacts
    sender_phone: str
    receiver_name: str
    receiver_phone: str
    goods_note: str
    payment_method: Literal["cash_pickup", "cash_drop", "upi"]


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_type: str
    vehicle_name: str
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float
    sender_phone: str
    receiver_name: str
    receiver_phone: str
    goods_note: str
    payment_method: str
    driver_name: str
    driver_phone: str
    vehicle_number: str
    status: StatusLiteral = "searching"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StatusUpdate(BaseModel):
    status: StatusLiteral


# ---------- Helpers ----------
def _friendly_google_error(status_code: int, body: str) -> str:
    b = (body or "").lower()
    if status_code == 403 or "permission_denied" in b or "api_key_service_blocked" in b:
        return ("Google Maps API key is not authorized for this service. "
                "Please enable the API on your key's restriction list in Google Cloud Console.")
    if "request_denied" in b or status_code == 401:
        return "Google Maps API key is invalid or unauthorized."
    if "over_query_limit" in b or status_code == 429:
        return "Google Maps quota exceeded. Please try again later."
    if "invalid_request" in b or status_code == 400:
        return "Invalid address. Please check the pickup/drop-off addresses."
    if "zero_results" in b:
        return "No route found between the selected addresses."
    return "Google Maps service is temporarily unavailable. Please try again."


def _generate_vehicle_number() -> str:
    state = random.choice(STATE_CODES)
    district = f"{random.randint(1, 99):02d}"
    letters = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
    digits = f"{random.randint(1000, 9999)}"
    return f"{state} {district} {letters} {digits}"


# ---------- Google Maps routes ----------
@api_router.get("/")
async def root():
    return {"message": "ShiftLogistics API", "status": "operational"}


@api_router.get("/vehicles")
async def vehicles():
    return {"vehicles": [
        {"id": "two_wheeler", "name": "TWO-WHEELER", "rate": 10, "capacity": "20 KG"},
        {"id": "tata_ace", "name": "TATA ACE", "rate": 20, "capacity": "750 KG"},
        {"id": "bada_dost", "name": "BADA DOST", "rate": 30, "capacity": "1500 KG"},
    ]}


@api_router.get("/maps/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(q: str = Query(..., min_length=2)):
    body = {"input": q, "includeQueryPredictions": False}
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.post("https://places.googleapis.com/v1/places:autocomplete", json=body, headers=headers)
    except httpx.HTTPError as e:
        logger.error(f"Google Places network error: {e}")
        raise HTTPException(status_code=502, detail="Unable to reach Google Maps. Check your connection.")
    if r.status_code != 200:
        logger.error(f"Google Places {r.status_code}: {r.text[:400]}")
        raise HTTPException(status_code=r.status_code, detail=_friendly_google_error(r.status_code, r.text))
    data = r.json()
    suggestions = []
    for s in data.get("suggestions", []):
        p = s.get("placePrediction")
        if p:
            suggestions.append({"placeId": p.get("placeId", ""), "text": (p.get("text") or {}).get("text", "")})
    return {"suggestions": suggestions, "provider": "google"}


@api_router.get("/maps/distance-km", response_model=DistanceResponse)
async def distance_km(origin: str, destination: str):
    def _fmt(val: str) -> str:
        if val.startswith("place_id:") or "," in val:
            return val
        if " " not in val and len(val) > 20:
            return f"place_id:{val}"
        return val

    params = {"origins": _fmt(origin), "destinations": _fmt(destination), "units": "metric", "key": GOOGLE_MAPS_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.get("https://maps.googleapis.com/maps/api/distancematrix/json", params=params)
    except httpx.HTTPError as e:
        logger.error(f"Distance Matrix network error: {e}")
        raise HTTPException(status_code=502, detail="Unable to reach Google Maps. Check your connection.")
    if r.status_code != 200:
        logger.error(f"Distance Matrix HTTP {r.status_code}: {r.text[:400]}")
        raise HTTPException(status_code=r.status_code, detail=_friendly_google_error(r.status_code, r.text))
    data = r.json()
    if data.get("status") != "OK":
        err_msg = data.get("error_message") or data.get("status") or "Unknown error"
        raise HTTPException(status_code=400, detail=_friendly_google_error(400, f"{data.get('status')} {err_msg}"))
    try:
        element = data["rows"][0]["elements"][0]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Google Maps returned an unexpected response.")
    if element.get("status") != "OK":
        raise HTTPException(status_code=400, detail=_friendly_google_error(400, element.get("status", "")))
    km = round(element["distance"]["value"] / 1000, 2)
    return {
        "distance_km": km,
        "distance_text": element["distance"].get("text", f"{km} km"),
        "duration_text": (element.get("duration") or {}).get("text"),
        "provider": "google",
    }


# ---------- Booking routes ----------
@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    if payload.vehicle_type not in VEHICLE_RATES:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")
    fare = round(payload.distance_km * VEHICLE_RATES[payload.vehicle_type], 2)
    driver = random.choice(DRIVERS)
    booking = Booking(
        vehicle_type=payload.vehicle_type,
        vehicle_name=VEHICLE_NAMES[payload.vehicle_type],
        pickup_address=payload.pickup_address,
        dropoff_address=payload.dropoff_address,
        distance_km=payload.distance_km,
        fare=fare,
        sender_phone=payload.sender_phone.strip(),
        receiver_name=payload.receiver_name.strip(),
        receiver_phone=payload.receiver_phone.strip(),
        goods_note=payload.goods_note.strip(),
        payment_method=payload.payment_method,
        driver_name=driver["name"],
        driver_phone=driver["phone"],
        vehicle_number=_generate_vehicle_number(),
        status="searching",
    )
    await db.bookings.insert_one(booking.model_dump())
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings():
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Booking(**d) for d in docs]


@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking(**doc)


@api_router.patch("/bookings/{booking_id}/status", response_model=Booking)
async def update_status(booking_id: str, payload: StatusUpdate):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if payload.status not in STATUS_ORDER and payload.status != "cancelled":
        raise HTTPException(status_code=400, detail="Invalid status")
    doc["status"] = payload.status
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": doc["status"], "updated_at": doc["updated_at"]}})
    return Booking(**doc)


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
