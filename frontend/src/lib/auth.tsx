import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import { getMe, sendOtp, setAuthToken, User, verifyOtp } from "@/src/lib/api";

type Ctx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verify: (phone: string, otp: string, name?: string) => Promise<User>;
  refreshMe: () => Promise<void>;
  updateUser: (u: User) => void;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

const TOKEN_KEY = "@luxe.auth.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem(TOKEN_KEY);
        if (stored) {
          setToken(stored);
          setAuthToken(stored);
          try {
            const me = await getMe();
            setUser(me);
          } catch {
            await storage.removeItem(TOKEN_KEY);
            setAuthToken(null);
            setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await sendOtp(phone);
  }, []);

  const verify = useCallback(async (phone: string, otp: string, name?: string) => {
    const { token: t, user: u } = await verifyOtp(phone, otp, name);
    await storage.setItem(TOKEN_KEY, t);
    setAuthToken(t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      // ignore
    }
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  const signOut = useCallback(async () => {
    await storage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, token, loading, requestOtp, verify, refreshMe, updateUser, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
