// pages/api/auth/send-otp.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { setOtp } from '../../../lib/otpStore';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const VERIFY_SID = process.env.TWILIO_VERIFY_SID;

function basicAuthHeader() {
  if (!ACCOUNT_SID || !AUTH_TOKEN) return null;
  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  return `Basic ${creds}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone } = req.body as { phone?: string };
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'Missing phone' });

  try {
    if (VERIFY_SID) {
      // Use Twilio Verify
      const url = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
      const body = new URLSearchParams({ To: phone, Channel: 'sms' });
      const auth = basicAuthHeader();
      if (!auth) return res.status(500).json({ error: 'Twilio credentials missing' });
      const r = await fetch(url, { method: 'POST', body, headers: { Authorization: auth } });
      const data = await r.json();
      if (!r.ok) {
        return res.status(502).json({ error: 'Twilio Verify error', details: data });
      }
      return res.status(200).json({ success: true });
    } else {
      // Fallback: generate OTP, store in memory, send via Messaging API
      if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) return res.status(500).json({ error: 'Twilio credentials missing' });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setOtp(phone, code, 5 * 60); // 5 minutes

      const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({ To: phone, From: FROM_NUMBER, Body: `Your JURTO login code: ${code}` });
      const auth = basicAuthHeader();
      if (!auth) return res.status(500).json({ error: 'Twilio credentials missing' });
      const r = await fetch(url, { method: 'POST', body, headers: { Authorization: auth } });
      const data = await r.json();
      if (!r.ok) {
        return res.status(502).json({ error: 'Twilio Messaging error', details: data });
      }
      return res.status(200).json({ success: true });
    }
  } catch (err: any) {
    console.error('send-otp error', err);
    return res.status(500).json({ error: 'Server error', message: err.message || String(err) });
  }
}
