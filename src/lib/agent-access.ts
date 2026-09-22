import { createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const sessionSeconds = 2 * 60 * 60;
const issuer = 'fineprint';
const audience = 'fineprint-source-agent';

export function accessConfiguration() {
  const accessKey = process.env.FINEPRINT_AGENT_ACCESS_KEY ?? '';
  const sessionSecret = process.env.FINEPRINT_SESSION_SECRET ?? '';
  return {
    required: process.env.FINEPRINT_REQUIRE_ACCESS_CODE === 'true',
    configured: accessKey.length >= 24 && sessionSecret.length >= 32,
    accessKey,
    sessionSecret,
  };
}

export function sessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-fineprint-agent' : 'fineprint-agent';
}

export function acceptsAccessKey(candidate: string) {
  const config = accessConfiguration();
  if (!config.configured || candidate.length > 160) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(config.accessKey));
}

export async function createAgentSession(now = new Date()) {
  const config = accessConfiguration();
  if (!config.configured) throw new Error('Source-agent access is not configured.');
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ scope: 'explain' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + sessionSeconds)
    .sign(new TextEncoder().encode(config.sessionSecret));
}

export async function agentAccess(request: Request, now = new Date()) {
  const config = accessConfiguration();
  if (!config.required) return { required: false, available: true, authorized: true };
  const state = { required: true, available: config.configured, authorized: false };
  if (!config.configured) return state;
  const prefix = `${sessionCookieName()}=`;
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  const token = cookie?.slice(prefix.length);
  if (!token || token.length > 2048) return state;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.sessionSecret), {
      algorithms: ['HS256'],
      issuer,
      audience,
      requiredClaims: ['exp', 'iat', 'scope'],
      maxTokenAge: sessionSeconds,
      currentDate: now,
    });
    return { ...state, authorized: payload.scope === 'explain' };
  } catch {
    return state;
  }
}

export function agentCookie(token: string, clear = false) {
  return `${sessionCookieName()}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : sessionSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
