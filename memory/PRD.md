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

## API Endpoints
- `GET /api/vehicles`
- `GET /api/maps/autocomplete?q=`
- `GET /api/maps/distance-km?origin=&destination=`
- `POST /api/bookings` — create; server recalculates fare
- `GET /api/bookings` — list (skips malformed docs)
- `GET /api/bookings/{id}` — single
- `PATCH /api/bookings/{id}/status`

## Design
Brutalist LIGHT: hard 2pt black borders, no border-radius, no shadow, mono type for data, orange `#FF4500` accent, yellow `#FFC300` for license plates, green `#00B85E` for completed timeline steps.

## Test Report
16/16 backend pytest + full frontend E2E via Playwright — see `/app/test_reports/iteration_5.json`.
