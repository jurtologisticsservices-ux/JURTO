import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  API,
  Notification,
  fetchNotifications,
  markAllNotificationsRead,
  clearNotifications as clearNotifsApi,
} from "@/src/lib/api";

// -------- Toast pub/sub --------
export type Toast = {
  id: string;
  title: string;
  body: string;
  variant: "info" | "success" | "brand";
};

type ToastListener = (t: Toast) => void;
const toastListeners: Set<ToastListener> = new Set();

export function subscribeToast(fn: ToastListener) {
  toastListeners.add(fn);
  return () => {
    toastListeners.delete(fn);
  };
}

export function pushToast(t: Omit<Toast, "id"> & { id?: string }) {
  const toast: Toast = { id: t.id ?? String(Date.now() + Math.random()), ...t };
  toastListeners.forEach((l) => l(toast));
}

// -------- Notifications Context --------
type Ctx = {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  connected: boolean;
};

const NotificationsCtx = createContext<Ctx | null>(null);

function variantFor(type: Notification["type"]): Toast["variant"] {
  if (type === "STATUS_DELIVERED") return "success";
  if (type === "BOOKING_CONFIRMED") return "brand";
  return "info";
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const firstConnectRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchNotifications();
      setNotifications(list);
    } catch {
      // silent
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
    } catch {
      // ignore server error; still update UI
    }
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await clearNotifsApi();
    } catch {
      // ignore
    }
    setNotifications([]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const wsUrl = API.replace(/^http/, "ws") + "/ws/notifications";
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          if (!firstConnectRef.current) {
            // On reconnect refresh state (we may have missed events)
            refresh();
          } else {
            firstConnectRef.current = false;
          }
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.event === "notification") {
              const n: Notification = {
                id: data.id,
                booking_id: data.booking_id,
                type: data.type,
                title: data.title,
                body: data.body,
                read: !!data.read,
                created_at: data.created_at,
                driver_name: data.driver_name ?? null,
                vehicle_number: data.vehicle_number ?? null,
                vehicle_name: data.vehicle_name ?? null,
                fare: data.fare ?? null,
                pickup_address: data.pickup_address ?? null,
                dropoff_address: data.dropoff_address ?? null,
              };
              setNotifications((prev) => {
                if (prev.find((x) => x.id === n.id)) return prev;
                return [n, ...prev].slice(0, 200);
              });
              pushToast({ title: n.title, body: n.body, variant: variantFor(n.type) });
            }
          } catch {
            // ignore malformed messages
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
  }, [refresh]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: Ctx = { notifications, unreadCount, markAllRead, clearAll, refresh, connected };
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
