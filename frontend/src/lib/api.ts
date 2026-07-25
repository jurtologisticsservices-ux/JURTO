const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE_URL}/api`;

export type Vehicle = {
  id: "two_wheeler" | "tata_ace" | "bada_dost";
  name: string;
  rate: number;
  capacity: string;
  image: string;
};

export const VEHICLES: Vehicle[] = [
  {
    id: "two_wheeler",
    name: "TWO-WHEELER",
    rate: 10,
    capacity: "20 KG",
    image:
      "https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHwxfHxtb3RvcmN5Y2xlJTIwZGVsaXZlcnklMjBib3glMjBsb2dpc3RpY3N8ZW58MHx8fHwxNzg0OTkzOTQ1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "tata_ace",
    name: "TATA ACE",
    rate: 20,
    capacity: "750 KG",
    image:
      "https://images.unsplash.com/photo-1601467995997-ac1ae9a8fff4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxtaW5pJTIwdHJ1Y2slMjBsb2dpc3RpY3MlMjBjYXJnb3xlbnwwfHx8fDE3ODQ5OTM5NDV8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "bada_dost",
    name: "BADA DOST",
    rate: 30,
    capacity: "1500 KG",
    image:
      "https://images.unsplash.com/photo-1616432043562-3671ea2e5242?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxsYXJnZSUyMGNhcmdvJTIwdHJ1Y2slMjBsb2dpc3RpY3N8ZW58MHx8fHwxNzg0OTkzOTQ1fDA&ixlib=rb-4.1.0&q=85",
  },
];

export type Suggestion = { placeId: string; text: string };

export type BookingStatus = "searching" | "assigned" | "picked_up" | "delivered" | "cancelled";

export type Booking = {
  id: string;
  vehicle_type: Vehicle["id"];
  vehicle_name: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  fare: number;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  goods_note: string;
  payment_method: "cash_pickup" | "cash_drop" | "upi";
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
};

export type CreateBookingInput = {
  vehicle_type: Vehicle["id"];
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  fare: number;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  goods_note: string;
  payment_method: "cash_pickup" | "cash_drop" | "upi";
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function fetchSuggestions(q: string): Promise<Suggestion[]> {
  const res = await fetch(`${API}/maps/autocomplete?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.suggestions ?? [];
}

export async function fetchDistance(originPlaceId: string, destinationPlaceId: string) {
  const url = `${API}/maps/distance-km?origin=${encodeURIComponent(originPlaceId)}&destination=${encodeURIComponent(destinationPlaceId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { distance_km: number; distance_text: string; duration_text: string | null; provider: string };
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Booking;
}

export async function getBooking(id: string): Promise<Booking> {
  const res = await fetch(`${API}/bookings/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Booking;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  const res = await fetch(`${API}/bookings/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Booking;
}

export async function listBookings(): Promise<Booking[]> {
  const res = await fetch(`${API}/bookings`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Booking[];
}
