import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import {
  acceptsAccessKey,
  agentAccess,
  agentCookie,
  createAgentSession,
  sessionCookieName,
} from '../src/lib/agent-access';

const key = 'test-access-key-with-enough-entropy';
const secret = 'test-session-secret-32-characters-minimum';
const now = new Date('2026-09-20T12:00:00Z');
function request(token?: string) {
  return new Request('https://fineprint.vercel.app/api/explain', {
    headers: token ? { cookie: `${sessionCookieName()}=${token}` } : {},
  });
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'true');
  vi.stubEnv('FINEPRINT_AGENT_ACCESS_KEY', key);
  vi.stubEnv('FINEPRINT_SESSION_SECRET', secret);
});
afterEach(() => vi.unstubAllEnvs());

describe('source agent access', () => {
  it('requires a session in production', async () => {
    expect(await agentAccess(request(), now)).toEqual({
      required: true,
      available: true,
      authorized: false,
    });
  });
  it.each(['FINEPRINT_AGENT_ACCESS_KEY', 'FINEPRINT_SESSION_SECRET'])(
    'fails closed with incomplete %s',
    async (name) => {
      vi.stubEnv(name, '');
      expect(await agentAccess(request(), now)).toEqual({
        required: true,
        available: false,
        authorized: false,
      });
    },
  );
  it('keeps the existing unconfigured local workflow', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'false');
    expect((await agentAccess(request(), now)).authorized).toBe(true);
  });
  it('supports explicitly testing access in local development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect((await agentAccess(request(), now)).authorized).toBe(false);
  });
  it('accepts only the exact configured code', () => {
    expect(acceptsAccessKey(key)).toBe(true);
    expect(acceptsAccessKey(key.toUpperCase())).toBe(false);
    expect(acceptsAccessKey('')).toBe(false);
    expect(acceptsAccessKey('x'.repeat(161))).toBe(false);
  });
  it('issues a valid session without embedding the access code', async () => {
    const token = await createAgentSession(now);
    expect((await agentAccess(request(token), now)).authorized).toBe(true);
    expect(Buffer.from(token.split('.')[1], 'base64url').toString()).not.toContain(key);
  });
  it('expires the session at two hours', async () => {
    const token = await createAgentSession(now);
    expect(
      (await agentAccess(request(token), new Date(now.getTime() + 7_199_000))).authorized,
    ).toBe(true);
    expect(
      (await agentAccess(request(token), new Date(now.getTime() + 7_200_000))).authorized,
    ).toBe(false);
  });
  it('rejects a changed signature', async () => {
    const token = await createAgentSession(now);
    const parts = token.split('.');
    parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
    expect((await agentAccess(request(parts.join('.')), now)).authorized).toBe(false);
  });
  it('invalidates existing sessions when the secret rotates', async () => {
    const token = await createAgentSession(now);
    vi.stubEnv('FINEPRINT_SESSION_SECRET', 'different-session-secret-32-characters');
    expect((await agentAccess(request(token), now)).authorized).toBe(false);
  });
  it.each(['wrong-audience', 'wrong-scope', 'future-issued', 'missing-expiry'])(
    'rejects %s claims',
    async (variant) => {
      const issued = now.getTime() / 1000;
      let jwt = new SignJWT({ scope: variant === 'wrong-scope' ? 'admin' : 'explain' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('fineprint')
        .setAudience(variant === 'wrong-audience' ? 'other-product' : 'fineprint-source-agent')
        .setIssuedAt(variant === 'future-issued' ? issued + 60 : issued);
      if (variant !== 'missing-expiry') jwt = jwt.setExpirationTime(issued + 7200);
      const token = await jwt.sign(new TextEncoder().encode(secret));
      expect((await agentAccess(request(token), now)).authorized).toBe(false);
    },
  );
  it('uses a host-only secure HttpOnly cookie in production and clears it on logout', () => {
    expect(agentCookie('token')).toContain(
      '__Host-fineprint-agent=token; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200; Secure',
    );
    expect(agentCookie('', true)).toContain('Max-Age=0; Secure');
    expect(agentCookie('token')).not.toContain('Domain=');
  });
});
