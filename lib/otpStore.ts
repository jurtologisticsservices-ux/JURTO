// lib/otpStore.ts

type OtpEntry = { code: string; expiresAt: number };

const store = new Map<string, OtpEntry>();

export function setOtp(phone: string, code: string, ttlSeconds = 300) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  store.set(phone, { code, expiresAt });
}

export function verifyOtp(phone: string, code: string) {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  const ok = entry.code === code;
  if (ok) store.delete(phone);
  return ok;
}

export function clearExpiredOtps() {
  const now = Date.now();
  for (const [phone, entry] of store) {
    if (entry.expiresAt <= now) store.delete(phone);
  }
}

// periodic cleanup (best-effort)
setInterval(clearExpiredOtps, 60 * 1000);
