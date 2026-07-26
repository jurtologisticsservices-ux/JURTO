# LuxeLogistics - Premium Chennai Logistics App

## Overview
High-end goods logistics booking app for Chennai with a Luxury Dark theme (Charcoal + Gold accents).
Fully authenticated per-user experience with real-time tracking, notifications, multi-stop delivery, and a 9-tier vehicle catalog.

## Design System
- **Personality**: Cinematic dark luxury — charcoal `#121212` surface, gold `#D4AF37` brand.
- **Typography**: Serif display (Georgia) + system sans body.
- **Corners**: Rounded `md=12 / lg=20 / pill=999`. Zero borders on cards; subtle 1pt `#2A2A2A`.

## App Flow
Welcome → Phone Login → OTP Verify → Home (Live Map) → Multi-Stop Address Entry → Vehicle Selection (Hero card + list of 9) → Booking Summary + Payment → Live Tracking. Bottom tabs = Home / Orders / Account.

## Vehicle Catalog (9)
Two-Wheeler 20kg · Mini 3W 90kg · 3 Wheeler 500kg · Tata Ace 750kg · Pickup 8ft 1200kg · Pickup 9ft 1700kg · Tata 407 2500kg · 14ft 3500kg · 17ft 4500kg. Rates are internal only — customer sees only the final total fare.

## Authentication
- Phone-OTP JWT (HS256, 30-day, `JWT_SECRET`).
- `OTP_MODE=mock` — any 6-digit code accepted. Swap `OTP_MODE=twilio` (+ Twilio env) to enable real SMS.

## Backend
- MongoDB collections: `users`, `orders` (persistent, ready for future Driver App), `addresses`, `notifications`. Legacy `bookings` retained but hidden.
- All order/notification endpoints require `Authorization: Bearer <JWT>`. WebSockets accept `?token=`.
- Google APIs: Places Autocomplete (New), Distance Matrix, Geocoding.
- Multi-stop distance via `POST /api/maps/distance-multi` (sum of consecutive hops).
- Background driver simulator ticks every 2s, broadcasts over `/api/ws/tracking/{id}` and `/api/ws/notifications`.

## Frontend
- Expo Router with route guard via `AuthProvider` redirecting unauth users to `/welcome`.
- Booking wizard state in a lightweight `useSyncExternalStore` (`bookingStore`).
- Live pickup auto-detect via `expo-location` (falls back to Chennai centre `13.0827, 80.2707`).
- Map = Leaflet + OSM tiles in `react-native-webview` (native) / `<iframe>` (web).

## Account Sub-pages
- `/account/addresses` — full CRUD (Google Places autocomplete)
- `/account/gst` — functional (persists to user profile)
- `/account/refer` — real code generation + Copy to clipboard (share coming soon)
- `/account/help` — reach us + FAQ
- `/account/terms` — full terms text
