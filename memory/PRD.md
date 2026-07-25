# ShiftLogistics - Vehicle Booking App

## Overview
Mobile-first React Native/Expo app for booking logistics vehicles (Two-Wheeler, Tata Ace, Bada Dost) with real-time distance-based fare calculation.

## Core Features
- Vehicle type selection (Two-wheeler ₹10/km, Tata Ace ₹20/km, Bada Dost ₹30/km)
- Address autocomplete for pickup and drop-off
- Automatic distance calculation between two addresses
- Real-time fare calculation displayed prominently
- "Book Now" flow with name + phone confirmation
- Bookings persisted to MongoDB

## Architecture
- **Frontend**: Expo React Native (index.tsx). Brutalist LIGHT design system - hard black borders (2pt), no border-radius, no shadows, mono fonts (Menlo/monospace) for data, Space Grotesk style display for headings. Orange (#FF4500) brand accent.
- **Backend**: FastAPI on port 8001 with `/api` prefix
- **Database**: MongoDB (`shift_logistics` DB, `bookings` collection)

## Distance Provider
- **Primary**: Google Maps (Places Autocomplete + Distance Matrix APIs) — via user's API key
- **Fallback (automatic)**: OpenStreetMap Nominatim (autocomplete + geocoding) + Haversine distance formula
- The backend detects Google API failures (e.g., APIs not enabled) and transparently falls back to OSM

## API Endpoints
- `GET /api/vehicles` - list vehicles + rates
- `GET /api/maps/autocomplete?q=...` - address suggestions
- `GET /api/maps/distance-km?origin=...&destination=...` - distance
- `POST /api/bookings` - create booking (server recalculates fare)
- `GET /api/bookings` - list bookings

## Known Setup Note
The user's Google Maps API key currently does NOT have the required APIs enabled (Places API New, Distance Matrix API). The app works via OSM fallback automatically. To enable Google Maps:
1. Open Google Cloud Console for project 422678728685
2. Enable: Places API (New), Distance Matrix API
3. Wait a few minutes; backend will auto-switch to Google.
