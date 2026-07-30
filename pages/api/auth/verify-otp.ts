// pages/api/auth/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyOtp } from '../../../lib/otpStore';
import { signJwt } from '../../../lib/jwt';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID = process.env.TWILIO_VERIFY_SID;

function basicAuthHeader() {
  if (!ACCOUNT_SID || !AUTH_TOKEN) return null;
  const creds = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  return `Basic ${creds}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, otp } = req.body as { phone?: string; otp?: string };
  if (!phone || !otp) return res.status(400).json({ error: 'Missing phone or otp' });

  try {
    let ok = false;
    if (VERIFY_SID) {
      const url = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;
      const params = new URLSearchParams({ To: phone, Code: otp });
      const auth = basicAuthHeader();
      if (!auth) return res.status(500).json({ error: 'Twilio credentials missing' });
      const r = await fetch(`${url}?${params.toString()}`, { headers: { Authorization: auth } });
      const data = await r.json();
      if (!r.ok) {
        return res.status(502).json({ error: 'Twilio Verify check error', details: data });
      }
      ok = data.status === 'approved' || data.status === 'approved';
    } else {
      ok = verifyOtp(phone, otp);
    }

    if (!ok) return res.status(401).json({ error: 'Invalid otp' });

    // On success, create JWT and set cookie
    const token = signJwt({ phone }, { expiresInSeconds: 60 * 60 * 24 * 7 });
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `jurto_token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax; ${isProd ? 'Secure;' : ''}`);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('verify-otp error', err);
    return res.status(500).json({ error: 'Server error', message: err.message || String(err) });
  }
}
