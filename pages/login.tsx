// pages/login.tsx
import React, { useState, useEffect, useRef } from 'react';

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setTimer(60);
    timerRef.current = window.setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to send OTP');
      setStep('otp');
      startTimer();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to verify OTP');
      // success — simple redirect to home
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function resend() {
    if (timer > 0) return;
    sendOtp();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 20 }}>
      <div style={{ width: 380, borderRadius: 8, padding: 24, boxShadow: '0 6px 24px rgba(0,0,0,0.08)' }}>
        <h2 style={{ margin: 0, marginBottom: 8 }}>Welcome to JURTO</h2>
        <p style={{ marginTop: 0, marginBottom: 18, color: '#555' }}>Sign in with your mobile number</p>

        {step === 'phone' && (
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Mobile number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e6e6e6', marginBottom: 12 }} />
            <button onClick={sendOtp} disabled={loading} style={{ width: '100%', padding: 10, background: '#007bff', color: '#fff', border: 'none', borderRadius: 6 }}>{loading ? 'Sending...' : 'Send OTP'}</button>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Enter 6-digit OTP</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #e6e6e6', marginBottom: 12, letterSpacing: 6, fontSize: 18 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={verifyOtp} disabled={loading || otp.length !== 6} style={{ flex: 1, padding: 10, background: '#28a745', color: '#fff', border: 'none', borderRadius: 6 }}>{loading ? 'Verifying...' : 'Verify & Continue'}</button>
              <button onClick={resend} disabled={timer > 0} style={{ padding: 10, background: timer > 0 ? '#f0f0f0' : '#fff', border: '1px solid #e6e6e6', borderRadius: 6 }}>{timer > 0 ? `Resend in ${timer}s` : 'Resend'}</button>
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>Didn't receive? Check number or try again.</div>
          </div>
        )}

        {error && <div style={{ marginTop: 12, color: 'red' }}>{error}</div>}

      </div>
    </div>
  );
}
