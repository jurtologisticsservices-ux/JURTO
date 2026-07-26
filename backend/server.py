from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import re
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Set, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_MAPS_API_KEY = os.environ['GOOGLE_MAPS_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_TTL_DAYS = 30
OTP_MODE = os.environ.get("OTP_MODE", "mock")  # "mock" or "twilio"

# ---------- Vehicle catalogue ----------
VEHICLES: List[dict] = [
    {"id": "two_wheeler",   "name": "Two-Wheeler",  "capacity_kg": 20,   "rate": 10, "eta_min": 5,  "icon": "motorbike"},
    {"id": "mini_3w",       "name": "Mini 3W",      "capacity_kg": 90,   "rate": 14, "eta_min": 7,  "icon": "rickshaw"},
    {"id": "three_wheeler", "name": "3 Wheeler",    "capacity_kg": 500,  "rate": 18, "eta_min": 8,  "icon": "auto-rickshaw"},
    {"id": "tata_ace",      "name": "Tata Ace",     "capacity_kg": 750,  "rate": 22, "eta_min": 10, "icon": "van"},
    {"id": "pickup_8ft",    "name": "Pickup 8ft",   "capacity_kg": 1200, "rate": 28, "eta_min": 12, "icon": "van-utility"},
    {"id": "pickup_9ft",    "name": "Pickup 9ft",   "capacity_kg": 1700, "rate": 34, "eta_min": 14, "icon": "van-utility"},
    {"id": "tata_407",      "name": "Tata 407",     "capacity_kg": 2500, "rate": 42, "eta_min": 16, "icon": "truck"},
    {"id": "truck_14ft",    "name": "14ft Truck",   "capacity_kg": 3500, "rate": 55, "eta_min": 20, "icon": "truck"},
    {"id": "truck_17ft",    "name": "17ft Truck",   "capacity_kg": 4500, "rate": 68, "eta_min": 22, "icon": "truck"},
]
VEHICLE_BY_ID: Dict[str, dict] = {v["id"]: v for v in VEHICLES}

DRIVERS = [
    {"name": "Karthik Rajan", "phone": "+919876543210"},
    {"name": "Suresh Yadav", "phone": "+919123456780"},
    {"name": "Vijay Singh", "phone": "+919812345678"},
    {"name": "Anbu Selvan",  "phone": "+919845123456"},
    {"name": "Manoj Patel",  "phone": "+919765432109"},
    {"name": "Prakash Reddy","phone": "+919887654321"},
]
STATE_CODES = ["TN", "KA", "MH", "DL", "UP", "GJ", "RJ", "TS", "AP", "KL"]
STATUS_ORDER: List[str] = ["searching", "assigned", "picked_up", "delivered"]
StatusLiteral = Literal["searching", "assigned", "picked_up", "delivered", "cancelled"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==========================================================================
# Models
# ==========================================================================
class User(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    gst_number: Optional[str] = None
    gst_business_name: Optional[str] = None
    created_at: str


class SendOtpRequest(BaseModel):
    phone: str


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: User


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    gst_number: Optional[str] = None
    gst_business_name: Optional[str] = None


class Address(BaseModel):
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_id: Optional[str] = None


class SavedAddress(BaseModel):
    id: str
    label: str  # e.g. Home, Office
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_id: Optional[str] = None


class SaveAddressRequest(BaseModel):
    label: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_id: Optional[str] = None


class Suggestion(BaseModel):
    placeId: str
    text: str


class AutocompleteResponse(BaseModel):
    suggestions: List[Suggestion]
    provider: str = "google"


class DistanceResponse(BaseModel):
    distance_km: float
    duration_text: Optional[str] = None
    hops: int = 0
    provider: str = "google"


class OrderCreate(BaseModel):
    vehicle_type: str
    stops: List[Address]  # first = pickup, rest = drops
    distance_km: float
    payment_method: Literal["cash_pickup", "cash_drop", "upi"]
    sender_phone: Optional[str] = None
    receiver_name: str
    receiver_phone: str
    goods_note: Optional[str] = None


class Order(BaseModel):
    id: str
    user_id: str
    vehicle_type: str
    vehicle_name: str
    stops: List[Address]
    distance_km: float
    fare: float
    payment_method: str
    sender_phone: str
    receiver_name: str
    receiver_phone: str
    goods_note: str = ""
    driver_name: str = ""
    driver_phone: str = ""
    vehicle_number: str = ""
    status: str = "searching"
    driver_lat: Optional[float] = None
    driver_lng: Optional[float] = None
    created_at: str
    updated_at: str


class StatusUpdate(BaseModel):
    status: StatusLiteral


class Notification(BaseModel):
    id: str
    user_id: str
    order_id: str
    type: str
    title: str
    body: str
    read: bool = False
    created_at: str
    driver_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_name: Optional[str] = None
    fare: Optional[float] = None


# ==========================================================================
# Helpers
# ==========================================================================
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        digits = "91" + digits
    return "+" + digits


def _make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def _decode_jwt(token: str) -> Optional[str]:
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1].strip()
    user_id = _decode_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**doc)


def _friendly_google_error(status_code: int, body: str) -> str:
    b = (body or "").lower()
    if status_code == 403 or "permission_denied" in b or "api_key_service_blocked" in b:
        return "Google Maps API not authorized for this key."
    if "request_denied" in b or status_code == 401:
        return "Google Maps API key is invalid."
    if "over_query_limit" in b or status_code == 429:
        return "Google Maps quota exceeded."
    if "invalid_request" in b or status_code == 400:
        return "Invalid address. Please check pickup/drop."
    if "zero_results" in b:
        return "No route found between selected addresses."
    return "Google Maps service temporarily unavailable."


def _generate_vehicle_number() -> str:
    state = random.choice(STATE_CODES)
    district = f"{random.randint(1, 99):02d}"
    letters = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
    digits = f"{random.randint(1000, 9999)}"
    return f"{state} {district} {letters} {digits}"


async def _geocode(address_or_placeid: str) -> Optional[Tuple[float, float]]:
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
        logger.warning(f"Geocode error: {e}")
        return None


# ==========================================================================
# WebSocket managers
# ==========================================================================
class WSManager:
    def __init__(self) -> None:
        self.connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, key: str, ws: WebSocket) -> None:
        self.connections.setdefault(key, set()).add(ws)

    def disconnect(self, key: str, ws: WebSocket) -> None:
        conns = self.connections.get(key)
        if conns:
            conns.discard(ws)
            if not conns:
                self.connections.pop(key, None)

    async def broadcast(self, key: str, payload: dict) -> None:
        for ws in list(self.connections.get(key, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(key, ws)


tracking_manager = WSManager()  # keyed by order_id
notif_manager = WSManager()      # keyed by user_id


STATUS_NOTIFICATION_MAP: Dict[str, Tuple[str, str]] = {
    "assigned": ("Driver Assigned", "{driver_name} is heading to pickup ({vehicle_number})."),
    "picked_up": ("Goods Picked Up", "Your goods are on the way to the drop-off location."),
    "delivered": ("Delivered", "Your order has been delivered successfully. Thank you!"),
    "cancelled": ("Booking Cancelled", "Your booking was cancelled."),
}


async def _emit_notification(user_id: str, order_id: str, ntype: str, title: str, body: str, extra: Optional[dict] = None):
    doc: dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "order_id": order_id,
        "type": ntype,
        "title": title,
        "body": body,
        "read": False,
        "created_at": _now_iso(),
    }
    if extra:
        doc.update(extra)
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    await notif_manager.broadcast(user_id, {"event": "notification", **doc})
    return doc


# ==========================================================================
# Auth routes
# ==========================================================================
@api_router.post("/auth/send-otp")
async def send_otp(req: SendOtpRequest):
    phone = _normalize_phone(req.phone)
    if len(phone) < 12:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    # In mock mode: no real SMS is sent. Any 6-digit OTP is accepted at verify.
    logger.info(f"[OTP {OTP_MODE}] Send request for {phone}")
    return {"ok": True, "mode": OTP_MODE, "hint": "In dev mode, any 6-digit code is accepted"}


@api_router.post("/auth/verify-otp", response_model=AuthResponse)
async def verify_otp(req: VerifyOtpRequest):
    phone = _normalize_phone(req.phone)
    otp = re.sub(r"\D", "", req.otp)
    if len(otp) != 6:
        raise HTTPException(status_code=400, detail="OTP must be 6 digits")
    if OTP_MODE != "mock":
        raise HTTPException(status_code=500, detail="Real OTP not configured yet")

    doc = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not doc:
        doc = {
            "id": str(uuid.uuid4()),
            "phone": phone,
            "name": (req.name or "").strip() or None,
            "gst_number": None,
            "gst_business_name": None,
            "created_at": _now_iso(),
        }
        await db.users.insert_one(doc)
        doc.pop("_id", None)
    else:
        if req.name and not doc.get("name"):
            await db.users.update_one({"id": doc["id"]}, {"$set": {"name": req.name.strip()}})
            doc["name"] = req.name.strip()

    user = User(**doc)
    return {"token": _make_jwt(user.id), "user": user}


@api_router.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user


@api_router.patch("/auth/me", response_model=User)
async def patch_me(req: UpdateProfileRequest, user: User = Depends(get_current_user)):
    updates = {}
    if req.name is not None: updates["name"] = req.name.strip() or None
    if req.gst_number is not None: updates["gst_number"] = req.gst_number.strip() or None
    if req.gst_business_name is not None:
        updates["gst_business_name"] = req.gst_business_name.strip() or None
    if updates:
        await db.users.update_one({"id": user.id}, {"$set": updates})
    doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    return User(**doc)


# ==========================================================================
# Saved addresses
# ==========================================================================
@api_router.get("/addresses", response_model=List[SavedAddress])
async def list_addresses(user: User = Depends(get_current_user)):
    docs = await db.addresses.find({"user_id": user.id}, {"_id": 0, "user_id": 0}).sort("created_at", 1).to_list(50)
    return [SavedAddress(**d) for d in docs]


@api_router.post("/addresses", response_model=SavedAddress)
async def create_address(req: SaveAddressRequest, user: User = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "label": req.label.strip() or "Address",
        "address": req.address.strip(),
        "lat": req.lat,
        "lng": req.lng,
        "place_id": req.place_id,
        "created_at": _now_iso(),
    }
    await db.addresses.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return SavedAddress(**doc)


@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, user: User = Depends(get_current_user)):
    r = await db.addresses.delete_one({"id": address_id, "user_id": user.id})
    return {"deleted": r.deleted_count}


# ==========================================================================
# Vehicles + Maps
# ==========================================================================
@api_router.get("/")
async def root():
    return {"message": "LuxeLogistics API", "status": "operational"}


@api_router.get("/vehicles")
async def vehicles_route():
    # Do not expose rate in this response — front-end shouldn't need it for display.
    # But we still include it for the tracking / order card. UI hides the breakdown.
    return {"vehicles": VEHICLES}


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
        raise HTTPException(status_code=502, detail="Unable to reach Google Maps.")
    if r.status_code != 200:
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
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Unable to reach Google Maps.")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=_friendly_google_error(r.status_code, r.text))
    data = r.json()
    if data.get("status") != "OK":
        raise HTTPException(status_code=400, detail=_friendly_google_error(400, data.get("status", "")))
    try:
        element = data["rows"][0]["elements"][0]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Google Maps returned unexpected response.")
    if element.get("status") != "OK":
        raise HTTPException(status_code=400, detail=_friendly_google_error(400, element.get("status", "")))
    km = round(element["distance"]["value"] / 1000, 2)
    return {"distance_km": km, "duration_text": (element.get("duration") or {}).get("text"), "hops": 1, "provider": "google"}


class MultiHopRequest(BaseModel):
    stops: List[str]  # placeIds or "lat,lng" or free-form


@api_router.post("/maps/distance-multi", response_model=DistanceResponse)
async def distance_multi(req: MultiHopRequest):
    """Compute total road distance by summing consecutive hops via Distance Matrix."""
    if len(req.stops) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 stops")

    def _fmt(val: str) -> str:
        if val.startswith("place_id:") or "," in val:
            return val
        if " " not in val and len(val) > 20:
            return f"place_id:{val}"
        return val

    total_km = 0.0
    total_seconds = 0
    async with httpx.AsyncClient(timeout=20) as hc:
        for i in range(len(req.stops) - 1):
            params = {
                "origins": _fmt(req.stops[i]),
                "destinations": _fmt(req.stops[i + 1]),
                "units": "metric",
                "key": GOOGLE_MAPS_API_KEY,
            }
            r = await hc.get("https://maps.googleapis.com/maps/api/distancematrix/json", params=params)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail=_friendly_google_error(r.status_code, r.text))
            data = r.json()
            if data.get("status") != "OK":
                raise HTTPException(status_code=400, detail=_friendly_google_error(400, data.get("status", "")))
            el = data["rows"][0]["elements"][0]
            if el.get("status") != "OK":
                raise HTTPException(status_code=400, detail=_friendly_google_error(400, el.get("status", "")))
            total_km += el["distance"]["value"] / 1000
            total_seconds += (el.get("duration") or {}).get("value", 0)

    duration_text = None
    if total_seconds:
        hrs = total_seconds // 3600
        mins = round((total_seconds % 3600) / 60)
        duration_text = f"{hrs}h {mins}m" if hrs else f"{mins} mins"
    return {"distance_km": round(total_km, 2), "duration_text": duration_text, "hops": len(req.stops) - 1, "provider": "google"}


# ==========================================================================
# Orders (per-user)
# ==========================================================================
@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate, user: User = Depends(get_current_user)):
    if payload.vehicle_type not in VEHICLE_BY_ID:
        raise HTTPException(status_code=400, detail="Invalid vehicle type")
    if len(payload.stops) < 2:
        raise HTTPException(status_code=400, detail="At least pickup + one drop required")

    vehicle = VEHICLE_BY_ID[payload.vehicle_type]
    fare = round(payload.distance_km * vehicle["rate"], 2)

    # Geocode any stops that are missing coordinates
    stops: List[dict] = []
    for s in payload.stops:
        stop = s.model_dump()
        if stop.get("lat") is None or stop.get("lng") is None:
            key = stop.get("place_id") or stop.get("address")
            if key:
                coords = await _geocode(key)
                if coords:
                    stop["lat"], stop["lng"] = coords
        stops.append(stop)

    # Driver spawns near pickup
    driver_lat = driver_lng = None
    pickup = stops[0]
    if pickup.get("lat") and pickup.get("lng"):
        ol = random.uniform(-0.02, 0.02)
        og = random.uniform(-0.02, 0.02)
        if abs(ol) < 0.008: ol = 0.012 * (1 if ol >= 0 else -1)
        if abs(og) < 0.008: og = 0.012 * (1 if og >= 0 else -1)
        driver_lat = pickup["lat"] + ol
        driver_lng = pickup["lng"] + og

    driver = random.choice(DRIVERS)
    order_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "vehicle_type": vehicle["id"],
        "vehicle_name": vehicle["name"],
        "stops": stops,
        "distance_km": payload.distance_km,
        "fare": fare,
        "payment_method": payload.payment_method,
        "sender_phone": (payload.sender_phone or user.phone).strip(),
        "receiver_name": payload.receiver_name.strip(),
        "receiver_phone": payload.receiver_phone.strip(),
        "goods_note": (payload.goods_note or "").strip(),
        "driver_name": driver["name"],
        "driver_phone": driver["phone"],
        "vehicle_number": _generate_vehicle_number(),
        "status": "searching",
        "driver_lat": driver_lat,
        "driver_lng": driver_lng,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.orders.insert_one(order_doc)
    order_doc.pop("_id", None)

    await _emit_notification(
        user_id=user.id,
        order_id=order_doc["id"],
        ntype="BOOKING_CONFIRMED",
        title="Booking Confirmed",
        body=f"Your {vehicle['name']} booking is confirmed. We're finding a driver near you.",
        extra={"vehicle_name": vehicle["name"], "fare": fare},
    )
    return Order(**order_doc)


@api_router.get("/orders", response_model=List[Order])
async def list_orders(user: User = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        try:
            out.append(Order(**d))
        except Exception as e:
            logger.warning(f"Skipping malformed order {d.get('id')}: {e}")
    return out


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user: User = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": order_id, "user_id": user.id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**doc)


@api_router.patch("/orders/{order_id}/status", response_model=Order)
async def update_status(order_id: str, payload: StatusUpdate, user: User = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": order_id, "user_id": user.id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    doc["status"] = payload.status
    doc["updated_at"] = _now_iso()

    # Snap position on picked_up/delivered
    if payload.status == "picked_up" and doc["stops"] and doc["stops"][0].get("lat") is not None:
        doc["driver_lat"] = doc["stops"][0]["lat"]
        doc["driver_lng"] = doc["stops"][0]["lng"]
    if payload.status == "delivered" and doc["stops"]:
        last = doc["stops"][-1]
        if last.get("lat") is not None:
            doc["driver_lat"] = last["lat"]
            doc["driver_lng"] = last["lng"]

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": doc["status"], "updated_at": doc["updated_at"],
            "driver_lat": doc.get("driver_lat"), "driver_lng": doc.get("driver_lng"),
        }},
    )
    await tracking_manager.broadcast(order_id, {
        "type": "status", "status": doc["status"],
        "driver_lat": doc.get("driver_lat"), "driver_lng": doc.get("driver_lng"),
    })
    tmpl = STATUS_NOTIFICATION_MAP.get(payload.status)
    if tmpl:
        title, body_t = tmpl
        body = body_t.format(driver_name=doc.get("driver_name", "The driver"), vehicle_number=doc.get("vehicle_number", ""))
        await _emit_notification(
            user_id=user.id,
            order_id=order_id,
            ntype=f"STATUS_{payload.status.upper()}",
            title=title,
            body=body,
            extra={"vehicle_name": doc.get("vehicle_name"), "driver_name": doc.get("driver_name"),
                   "vehicle_number": doc.get("vehicle_number"), "fare": doc.get("fare")},
        )
    return Order(**doc)


# ==========================================================================
# Notifications
# ==========================================================================
@api_router.get("/notifications", response_model=List[Notification])
async def list_notifications(user: User = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        try:
            out.append(Notification(**d))
        except Exception:
            pass
    return out


@api_router.post("/notifications/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    r = await db.notifications.update_many({"user_id": user.id, "read": False}, {"$set": {"read": True}})
    return {"modified": r.modified_count}


@api_router.delete("/notifications")
async def clear_notifications(user: User = Depends(get_current_user)):
    r = await db.notifications.delete_many({"user_id": user.id})
    return {"deleted": r.deleted_count}


# ==========================================================================
# WebSockets
# ==========================================================================
@api_router.websocket("/ws/tracking/{order_id}")
async def ws_tracking(websocket: WebSocket, order_id: str, token: Optional[str] = None):
    await websocket.accept()
    user_id = _decode_jwt(token) if token else None
    if not user_id:
        await websocket.close(code=1008)
        return
    doc = await db.orders.find_one({"id": order_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        await websocket.close(code=1008)
        return

    await tracking_manager.connect(order_id, websocket)
    try:
        pickup = doc["stops"][0] if doc.get("stops") else {}
        drop = doc["stops"][-1] if doc.get("stops") else {}
        await websocket.send_json({
            "type": "snapshot",
            "status": doc.get("status"),
            "driver_lat": doc.get("driver_lat"),
            "driver_lng": doc.get("driver_lng"),
            "pickup_lat": pickup.get("lat"),
            "pickup_lng": pickup.get("lng"),
            "dropoff_lat": drop.get("lat"),
            "dropoff_lng": drop.get("lng"),
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        tracking_manager.disconnect(order_id, websocket)


@api_router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: Optional[str] = None):
    await websocket.accept()
    user_id = _decode_jwt(token) if token else None
    if not user_id:
        await websocket.close(code=1008)
        return
    await notif_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        notif_manager.disconnect(user_id, websocket)


# ==========================================================================
# Background driver simulator
# ==========================================================================
_sim_task: Optional[asyncio.Task] = None


async def _simulate_drivers_loop():
    while True:
        try:
            active = await db.orders.find(
                {"status": {"$in": ["searching", "assigned", "picked_up"]}},
                {"_id": 0},
            ).to_list(500)
            for doc in active:
                status = doc.get("status")
                stops = doc.get("stops") or []
                if not stops:
                    continue
                if status in ("searching", "assigned"):
                    tgt = stops[0]
                else:
                    tgt = stops[-1]
                dlat, dlng = doc.get("driver_lat"), doc.get("driver_lng")
                tlat, tlng = tgt.get("lat"), tgt.get("lng")
                if dlat is None or dlng is None or tlat is None or tlng is None:
                    continue
                new_lat = dlat + (tlat - dlat) * 0.15
                new_lng = dlng + (tlng - dlng) * 0.15
                await db.orders.update_one(
                    {"id": doc["id"]},
                    {"$set": {"driver_lat": new_lat, "driver_lng": new_lng}},
                )
                await tracking_manager.broadcast(doc["id"], {
                    "type": "location", "driver_lat": new_lat, "driver_lng": new_lng, "status": status,
                })
        except Exception as e:
            logger.warning(f"Sim tick error: {e}")
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
    # Indexes for fast lookups
    try:
        await db.users.create_index("phone", unique=True)
        await db.orders.create_index([("user_id", 1), ("created_at", -1)])
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.addresses.create_index("user_id")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    logger.info("LuxeLogistics API startup complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    global _sim_task
    if _sim_task:
        _sim_task.cancel()
    client.close()
