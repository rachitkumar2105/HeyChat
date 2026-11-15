import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import { unauthorized } from '../lib/errors.js';

export interface AccessClaims {
  sub: string;
  tv: number;
  sid: string;
}

export function signAccessToken(config: Config, claims: AccessClaims): string {
  return jwt.sign({ tv: claims.tv, sid: claims.sid }, config.keys.access, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    expiresIn: config.auth.accessTtlSeconds,
    jwtid: randomUUID(),
  });
}

export function verifyAccessToken(config: Config, token: string): AccessClaims & { exp: number } {
  try {
    const p = jwt.verify(token, config.keys.access, {
      algorithms: ['HS256'],
      issuer: config.auth.issuer,
      audience: config.auth.audience,
    }) as jwt.JwtPayload;
    if (typeof p.sub !== 'string' || typeof p.tv !== 'number' || typeof p.exp !== 'number') {
      throw new Error('bad claims');
    }
    return { sub: p.sub, tv: p.tv, sid: String(p.sid ?? ''), exp: p.exp };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw unauthorized('token_expired', 'Session expired.');
    throw unauthorized('invalid_token');
  }
}

/** Refresh tokens are opaque: "<sessionId>.<256-bit secret>". Only a SHA-256 of the secret is stored. */
export function newRefreshSecret(): { secret: string; hash: string } {
  const secret = randomBytes(32).toString('base64url');
  return { secret, hash: sha256(secret) };
}

export function parseRefreshToken(token: string): { sessionId: string; hash: string } {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) throw unauthorized('invalid_refresh_token');
  return { sessionId: m[1]!, hash: sha256(m[2]!) };
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
