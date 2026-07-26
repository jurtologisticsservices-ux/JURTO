const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE_URL}/api`;

// -------- Types --------
export type Vehicle = {
  id: string;
  name: string;
  capacity_kg: number;
  rate: number;
  eta_min: number;
  icon: string;
};

export type Suggestion = { placeId: string; text: string };

export type BookingStatus = "searching" | "assigned" | "picked_up" | "delivered" | "cancelled";

export type Address = {
  address: string;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
};

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
};

export type User = {
  id: string;
  phone: string;
  name?: string | null;
  gst_number?: string | null;
  gst_business_name?: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_name: string;
  stops: Address[];
  distance_km: number;
  fare: number;
  payment_method: "cash_pickup" | "cash_drop" | "upi";
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  goods_note: string;
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  status: BookingStatus;
  driver_lat?: number | null;
  driver_lng?: number | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  order_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  driver_name?: string | null;
  vehicle_number?: string | null;
  vehicle_name?: string | null;
  fare?: number | null;
};

// -------- Vehicle icons (MaterialCommunityIcons) --------
export const VEHICLE_ICON: Record<string, string> = {
  motorbike: "motorbike",
  rickshaw: "rickshaw",
  "auto-rickshaw": "rickshaw",
  van: "van-passenger",
  "van-utility": "van-utility",
  truck: "truck",
};

// -------- API helpers --------
let TOKEN: string | null = null;
export function setAuthToken(t: string | null) {
  TOKEN = t;
}
export function getAuthToken() {
  return TOKEN;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // ignore
  }
  return "Something went wrong. Please try again.";
}

function authHeaders(): Record<string, string> {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

// -------- Auth --------
export async function sendOtp(phone: string) {
  const res = await fetch(`${API}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function verifyOtp(phone: string, otp: string, name?: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp, name }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateProfile(payload: Partial<Pick<User, "name" | "gst_number" | "gst_business_name">>): Promise<User> {
  const res = await fetch(`${API}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// -------- Saved addresses --------
export async function listAddresses(): Promise<SavedAddress[]> {
  const res = await fetch(`${API}/addresses`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function saveAddress(payload: Omit<SavedAddress, "id">): Promise<SavedAddress> {
  const res = await fetch(`${API}/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function deleteAddress(id: string) {
  const res = await fetch(`${API}/addresses/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// -------- Maps + Vehicles --------
export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${API}/vehicles`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.vehicles;
}
export async function fetchSuggestions(q: string): Promise<Suggestion[]> {
  const res = await fetch(`${API}/maps/autocomplete?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).suggestions ?? [];
}
export async function fetchDistanceMulti(stops: string[]): Promise<{ distance_km: number; duration_text: string | null; hops: number }> {
  const res = await fetch(`${API}/maps/distance-multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stops }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// -------- Orders --------
export async function createOrder(payload: {
  vehicle_type: string;
  stops: Address[];
  distance_km: number;
  payment_method: Order["payment_method"];
  sender_phone?: string;
  receiver_name: string;
  receiver_phone: string;
  goods_note?: string;
}): Promise<Order> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function listOrders(): Promise<Order[]> {
  const res = await fetch(`${API}/orders`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(`${API}/orders/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function updateOrderStatus(id: string, status: BookingStatus): Promise<Order> {
  const res = await fetch(`${API}/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// -------- Notifications --------
export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API}/notifications`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function markAllNotificationsRead() {
  const res = await fetch(`${API}/notifications/read-all`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
export async function clearNotifications() {
  const res = await fetch(`${API}/notifications`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
