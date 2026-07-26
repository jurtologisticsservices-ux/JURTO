import { useSyncExternalStore } from "react";
import { Address, Vehicle } from "@/src/lib/api";

export type Stop = Address & { label?: string };

type State = {
  stops: Stop[]; // stops[0] = pickup; rest = drops
  vehicle: Vehicle | null;
  distanceKm: number | null;
  durationText: string | null;
  paymentMethod: "cash_pickup" | "cash_drop" | "upi";
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  goodsNote: string;
};

const initial: State = {
  stops: [
    { address: "", label: "Pickup" },
    { address: "", label: "Drop 1" },
  ],
  vehicle: null,
  distanceKm: null,
  durationText: null,
  paymentMethod: "cash_pickup",
  senderPhone: "",
  receiverName: "",
  receiverPhone: "",
  goodsNote: "",
};

let state: State = { ...initial };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const bookingStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set: (patch: Partial<State>) => {
    state = { ...state, ...patch };
    emit();
  },
  updateStop: (index: number, patch: Partial<Stop>) => {
    const next = state.stops.slice();
    next[index] = { ...next[index], ...patch };
    state = { ...state, stops: next };
    emit();
  },
  addStop: () => {
    if (state.stops.length >= 5) return;
    const next = state.stops.slice();
    next.push({ address: "", label: `Drop ${state.stops.length}` });
    state = { ...state, stops: next };
    emit();
  },
  removeStop: (index: number) => {
    if (index === 0 || state.stops.length <= 2) return;
    const next = state.stops.filter((_, i) => i !== index);
    // Relabel drops
    next.forEach((s, i) => {
      if (i === 0) s.label = "Pickup";
      else s.label = `Drop ${i}`;
    });
    state = { ...state, stops: next };
    emit();
  },
  reset: () => {
    state = {
      ...initial,
      stops: [
        { address: "", label: "Pickup" },
        { address: "", label: "Drop 1" },
      ],
    };
    emit();
  },
};

export function useBookingStore(): State {
  return useSyncExternalStore(
    bookingStore.subscribe,
    bookingStore.get,
    bookingStore.get,
  );
}
