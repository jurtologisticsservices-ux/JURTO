import { useEffect, useRef, useState } from "react";
import { API, Order, getAuthToken } from "@/src/lib/api";

export type TrackingSocketPayload = {
  type?: "snapshot" | "location" | "status";
  status?: Order["status"];
  driver_lat?: number | null;
  driver_lng?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
};

export function useTrackingSocket(orderId: string | undefined) {
  const [snap, setSnap] = useState<TrackingSocketPayload>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const token = getAuthToken();
    if (!token) return;
    const wsUrl = API.replace(/^http/, "ws") + `/ws/tracking/${orderId}?token=${encodeURIComponent(token)}`;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as TrackingSocketPayload;
            setSnap((prev) => ({ ...prev, ...data }));
          } catch {
            // ignore
          }
        };
        ws.onerror = () => setConnected(false);
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!closed) reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      }
    };
    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [orderId]);

  return { snap, connected };
}
