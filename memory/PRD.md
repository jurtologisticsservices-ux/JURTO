# ShiftLogistics - Vehicle Booking + Tracking App

## Overview
Mobile-first Expo React Native app for booking logistics vehicles in India with a complete booking → tracking → history flow.

## Navigation Architecture
- `app/(tabs)/` — Bottom tab layout with 2 tabs:
  - `index.tsx` — Booking screen (vehicle picker + addresses + fare)
  - `my-bookings.tsx` — Order history (Active + Past sections)
- `app/tracking/[id].tsx` — Stack-pushed route showing driver + timeline for a specific booking.

## Core Features
- Vehicle picker: Two-wheeler ₹10/km, Tata Ace ₹20/km, Bada Dost ₹30/km
- Google Places autocomplete for pickup & drop-off
- Google Distance Matrix — real road distance + ETA
- Booking Details bottom sheet: Sender phone, Receiver name, Receiver phone, Goods note, Payment method (COD Pickup / COD Drop / UPI)
- Auto driver + vehicle-number assignment on booking creation (random from a curated pool)
- Order Tracking screen: driver card with call-driver button (tel:), yellow license plate, 4-step timeline (Searching → Driver Assigned → Goods Picked Up → Delivered)
- Timeline auto-advances via PATCH `/api/bookings/{id}/status` at t=3s / 11s / 21s
- My Bookings: pull-to-refresh, active-on-top / past-below, color-coded status badges

## Live Tracking + Driver App
- On booking creation, backend geocodes pickup + dropoff via Google Geocoding API and places driver ~1–2 km from pickup.
- Background asyncio task moves driver 15% closer to target every 2s (target = pickup while `searching|assigned`, dropoff after `picked_up`).
- FastAPI **WebSocket** at `/api/ws/tracking/{id}` broadcasts `snapshot` on connect and `location` / `status` events afterwards. K8s preview ingress supports WS upgrade.
- Frontend live map: `react-native-webview` + Leaflet + OSM tiles on native; iframe fallback on web (both driven by the same `<LiveMap>` component with `injectJavaScript` / `contentWindow.updateData`).
- Client-side Haversine auto-transitions status when driver comes within ~150 m of the current target.
- **Driver Mode** screen at `/driver/[id]` — yellow-header, live map, status override buttons (`ACCEPT & DEPART` → `GOODS PICKED UP` → `DELIVERED`), sender / receiver call buttons. Reachable from a `DRIVER` button in the customer tracking header.

## API Endpoints
- `GET /api/vehicles`
- `GET /api/maps/autocomplete?q=`
- `GET /api/maps/distance-km?origin=&destination=`
- `POST /api/bookings` — geocodes + spawns driver + persists
- `GET /api/bookings` — list (skips malformed docs)
- `GET /api/bookings/{id}`
- `PATCH /api/bookings/{id}/status` — broadcasts to WS subscribers
- `WS /api/ws/tracking/{id}` — snapshot + live location + status events

## Design
Brutalist LIGHT: hard 2pt black borders, no border-radius, no shadow, mono type for data, orange `#FF4500` accent, yellow `#FFC300` for license plates, green `#00B85E` for completed timeline steps.

## Test Report
16/16 backend pytest + full frontend E2E via Playwright — see `/app/test_reports/iteration_5.json`.
