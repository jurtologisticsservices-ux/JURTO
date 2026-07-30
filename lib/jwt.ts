// lib/jwt.ts
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signJwt(payload: Record<string, any>, opts: { expiresInSeconds?: number } = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = opts.expiresInSeconds ? iat + opts.expiresInSeconds : iat + 60 * 60 * 24 * 7; // default 7 days
  const body = { ...payload, iat, exp };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.createHmac('sha256', SECRET).update(unsigned).digest();
  return `${unsigned}.${base64url(signature)}`;
}

export function verifyJwt(token: string) {
  try {
    const [unsigned, sig] = token.split('.').slice(0, 2).map((s) => s);
    if (!unsigned || !sig) return null;
    const signature = token.split('.').pop() || '';
    const expectedSig = base64url(crypto.createHmac('sha256', SECRET).update(unsigned).digest());
    if (expectedSig !== signature) return null;
    const payload = JSON.parse(Buffer.from(unsigned.split('.')[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (err) {
    return null;
  }
}
