from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Set, Tuple
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
    vehicle_type: str
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float
    sender_phone: str
    receiver_name: str
    receiver_phone: str
    goods_note: str
    payment_method: Literal["cash_pickup", "cash_drop", "upi"]


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_type: str
    vehicle_name: str = ""
    pickup_address: str
    dropoff_address: str
    distance_km: float
    fare: float
    sender_phone: str = ""
    receiver_name: str = ""
    receiver_phone: str = ""
    goods_note: str = ""
    payment_method: str = "cash_pickup"
    driver_name: str = ""
    driver_phone: str = ""
    vehicle_number: str = ""
    status: str = "searching"
    # Geo fields
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    driver_lat: Optional[float] = None
    driver_lng: Optional[float] = None
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


async def _geocode(address_or_placeid: str) -> Optional[Tuple[float, float]]:
    """Geocode a placeId or address via Google Geocoding API."""
    params: Dict[str, str] = {"key": GOOGLE_MAPS_API_KEY}
    if len(address_or_placeid) > 20 and " " not in address_or_placeid:
        params["place_id"] = address_or_placeid
    else:
        params["address"] = address_or_placeid
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("status") != "OK" or not data.get("results"):
            return None
        loc = data["results"][0]["geometry"]["location"]
        return (float(loc["lat"]), float(loc["lng"]))
    except Exception as e:
        logger.warning(f"Geocode error for '{address_or_placeid[:40]}': {e}")
        return None


# ---------- WebSocket manager ----------
class WSManager:
    def __init__(self) -> None:
        self.connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, booking_id: str, ws: WebSocket) -> None:
        self.connections.setdefault(booking_id, set()).add(ws)

    def disconnect(self, booking_id: str, ws: WebSocket) -> None:
        conns = self.connections.get(booking_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self.connections.pop(booking_id, None)

    async def broadcast(self, booking_id: str, payload: dict) -> None:
        conns = list(self.connections.get(booking_id, []))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(booking_id, ws)


manager = WSManager()


class NotificationManager:
    def __init__(self) -> None:
        self.conns: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        self.conns.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.conns.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        for ws in list(self.conns):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(ws)


notif_manager = NotificationManager()


STATUS_NOTIFICATION_MAP: Dict[str, Tuple[str, str]] = {
    "assigned": ("Driver Assigned",     "{driver_name} is heading to pickup ({vehicle_number})."),
    "picked_up": ("Goods Picked Up",    "Your goods are on the way to the drop-off location."),
    "delivered": ("Delivered",          "Your order has been delivered successfully. Thank you!"),
    "cancelled": ("Booking Cancelled",  "Your booking was cancelled."),
}


async def _emit_notification(
    booking_id: str,
    ntype: str,
    title: str,
    body: str,
    extra: Optional[dict] = None,
) -> dict:
    doc: dict = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "type": ntype,
        "title": title,
        "body": body,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        doc.update(extra)
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    await notif_manager.broadcast({"event": "notification", **doc})
    return doc


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

    # Geocode both addresses (best effort)
    pickup_coords = await _geocode(payload.pickup_address)
    dropoff_coords = await _geocode(payload.dropoff_address)

    driver_lat: Optional[float] = None
    driver_lng: Optional[float] = None
    if pickup_coords:
        # Random start ~1-2 km around pickup (1 deg lat ≈ 111 km → 0.01 deg ≈ 1.1 km)
        offset_lat = random.uniform(-0.02, 0.02)
        offset_lng = random.uniform(-0.02, 0.02)
        # Ensure not too close
        if abs(offset_lat) < 0.008:
            offset_lat = 0.012 * (1 if offset_lat >= 0 else -1)
        if abs(offset_lng) < 0.008:
            offset_lng = 0.012 * (1 if offset_lng >= 0 else -1)
        driver_lat = pickup_coords[0] + offset_lat
        driver_lng = pickup_coords[1] + offset_lng

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
        pickup_lat=pickup_coords[0] if pickup_coords else None,
        pickup_lng=pickup_coords[1] if pickup_coords else None,
        dropoff_lat=dropoff_coords[0] if dropoff_coords else None,
        dropoff_lng=dropoff_coords[1] if dropoff_coords else None,
        driver_lat=driver_lat,
        driver_lng=driver_lng,
    )
    await db.bookings.insert_one(booking.model_dump())
    # Fire notification
    await _emit_notification(
        booking_id=booking.id,
        ntype="BOOKING_CONFIRMED",
        title="Booking Confirmed",
        body=f"Your {booking.vehicle_name} booking is confirmed. We're finding a driver near you.",
        extra={
            "vehicle_name": booking.vehicle_name,
            "fare": booking.fare,
            "pickup_address": booking.pickup_address,
            "dropoff_address": booking.dropoff_address,
        },
    )
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings():
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    result: List[Booking] = []
    for d in docs:
        try:
            result.append(Booking(**d))
        except Exception as e:
            logger.warning(f"Skipping malformed booking {d.get('id')}: {e}")
    return result


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
    # If picked up, snap driver to pickup so next tick moves toward dropoff
    if payload.status == "picked_up" and doc.get("pickup_lat") is not None:
        doc["driver_lat"] = doc["pickup_lat"]
        doc["driver_lng"] = doc["pickup_lng"]
    if payload.status == "delivered" and doc.get("dropoff_lat") is not None:
        doc["driver_lat"] = doc["dropoff_lat"]
        doc["driver_lng"] = doc["dropoff_lng"]
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": doc["status"], "updated_at": doc["updated_at"],
            "driver_lat": doc.get("driver_lat"), "driver_lng": doc.get("driver_lng"),
        }},
    )
    # Notify subscribers of this booking
    await manager.broadcast(booking_id, {
        "type": "status",
        "status": doc["status"],
        "driver_lat": doc.get("driver_lat"),
        "driver_lng": doc.get("driver_lng"),
    })
    # Also emit a global notification for the app-wide feed
    tmpl = STATUS_NOTIFICATION_MAP.get(payload.status)
    if tmpl:
        title, body_tmpl = tmpl
        body = body_tmpl.format(
            driver_name=doc.get("driver_name", "The driver"),
            vehicle_number=doc.get("vehicle_number", ""),
        )
        await _emit_notification(
            booking_id=booking_id,
            ntype=f"STATUS_{payload.status.upper()}",
            title=title,
            body=body,
            extra={
                "vehicle_name": doc.get("vehicle_name"),
                "driver_name": doc.get("driver_name"),
                "vehicle_number": doc.get("vehicle_number"),
                "fare": doc.get("fare"),
            },
        )
    return Booking(**doc)


# ---------- WebSocket ----------
@api_router.websocket("/ws/tracking/{booking_id}")
async def ws_tracking(websocket: WebSocket, booking_id: str):
    await websocket.accept()
    await manager.connect(booking_id, websocket)
    try:
        doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if doc:
            await websocket.send_json({
                "type": "snapshot",
                "status": doc.get("status"),
                "driver_lat": doc.get("driver_lat"),
                "driver_lng": doc.get("driver_lng"),
                "pickup_lat": doc.get("pickup_lat"),
                "pickup_lng": doc.get("pickup_lng"),
                "dropoff_lat": doc.get("dropoff_lat"),
                "dropoff_lng": doc.get("dropoff_lng"),
            })
        while True:
            # We don't expect messages from client; but reading keeps the socket alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS closed: {e}")
    finally:
        manager.disconnect(booking_id, websocket)


@api_router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    await websocket.accept()
    await notif_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"Notif WS closed: {e}")
    finally:
        notif_manager.disconnect(websocket)


# ---------- Notifications REST ----------
@api_router.get("/notifications")
async def list_notifications():
    docs = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.post("/notifications/read-all")
async def mark_all_read():
    r = await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"modified": r.modified_count}


@api_router.delete("/notifications")
async def clear_notifications():
    r = await db.notifications.delete_many({})
    return {"deleted": r.deleted_count}


# ---------- Background driver simulator ----------
_sim_task: Optional[asyncio.Task] = None


async def _simulate_drivers_loop():
    """Every 2s, move each active driver 15% closer to its current target (pickup or dropoff)."""
    while True:
        try:
            active_docs = await db.bookings.find(
                {"status": {"$in": ["searching", "assigned", "picked_up"]}},
                {"_id": 0},
            ).to_list(500)
            for doc in active_docs:
                bid = doc["id"]
                status = doc.get("status")
                if status in ("searching", "assigned"):
                    tgt_lat, tgt_lng = doc.get("pickup_lat"), doc.get("pickup_lng")
                else:  # picked_up
                    tgt_lat, tgt_lng = doc.get("dropoff_lat"), doc.get("dropoff_lng")
                dlat, dlng = doc.get("driver_lat"), doc.get("driver_lng")
                if tgt_lat is None or tgt_lng is None or dlat is None or dlng is None:
                    continue
                # Step 15% toward target
                new_lat = dlat + (tgt_lat - dlat) * 0.15
                new_lng = dlng + (tgt_lng - dlng) * 0.15
                await db.bookings.update_one(
                    {"id": bid},
                    {"$set": {"driver_lat": new_lat, "driver_lng": new_lng}},
                )
                await manager.broadcast(bid, {
                    "type": "location",
                    "driver_lat": new_lat,
                    "driver_lng": new_lng,
                    "status": status,
                })
        except Exception as e:
            logger.warning(f"Driver simulator tick error: {e}")
        await asyncio.sleep(2)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_tasks():
    global _sim_task
    _sim_task = asyncio.create_task(_simulate_drivers_loop())
    logger.info("Started driver simulator background task")


@app.on_event("shutdown")
async def shutdown_db_client():
    global _sim_task
    if _sim_task:
        _sim_task.cancel()
    client.close()
