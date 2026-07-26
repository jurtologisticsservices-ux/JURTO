import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  API,
  Notification,
  fetchNotifications,
  markAllNotificationsRead,
  clearNotifications as clearNotifsApi,
  getAuthToken,
} from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

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

type Ctx = {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  connected: boolean;
};

const NotificationsCtx = createContext<Ctx | null>(null);

function variantFor(type: string): Toast["variant"] {
  if (type === "STATUS_DELIVERED") return "success";
  if (type === "BOOKING_CONFIRMED") return "brand";
  return "info";
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) return;
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
      // ignore
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
    if (token) refresh();
    else setNotifications([]);
  }, [token, refresh]);

  useEffect(() => {
    if (!token) {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      setConnected(false);
      return;
    }
    const wsUrl = API.replace(/^http/, "ws") + `/ws/notifications?token=${encodeURIComponent(token)}`;
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
            const data = JSON.parse(ev.data);
            if (data.event === "notification") {
              const n: Notification = {
                id: data.id,
                user_id: data.user_id,
                order_id: data.order_id,
                type: data.type,
                title: data.title,
                body: data.body,
                read: !!data.read,
                created_at: data.created_at,
                driver_name: data.driver_name ?? null,
                vehicle_number: data.vehicle_number ?? null,
                vehicle_name: data.vehicle_name ?? null,
                fare: data.fare ?? null,
              };
              setNotifications((prev) => {
                if (prev.find((x) => x.id === n.id)) return prev;
                return [n, ...prev].slice(0, 200);
              });
              pushToast({ title: n.title, body: n.body, variant: variantFor(n.type) });
            }
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
  }, [token]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<Ctx>(
    () => ({ notifications, unreadCount, markAllRead, clearAll, refresh, connected }),
    [notifications, unreadCount, markAllRead, clearAll, refresh, connected],
  );
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
