import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@vercel/firewall';
import { checkAgentLimit } from '../src/lib/agent-rate-limit';
vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));
const check = vi.mocked(checkRateLimit);
const request = new Request('https://fineprint.vercel.app/api/explain', {
  headers: {
    host: 'attacker.invalid',
    'x-real-ip': '192.0.2.1',
    cookie: 'private-session',
    authorization: 'private-credential',
  },
});
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('FINEPRINT_RATE_LIMIT_ID', 'fineprint-demo');
  vi.stubEnv('FINEPRINT_FIREWALL_HOST', 'fineprint.vercel.app');
  vi.stubEnv('RATE_LIMIT_SECRET', 'test-rate-limit-secret-32-characters');
  check.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

it('uses one shared explanation key and never forwards credentials or an untrusted host', async () => {
  check.mockResolvedValue({ rateLimited: false });
  expect(await checkAgentLimit(request, 'explain')).toEqual({ allowed: true });
  const options = check.mock.calls[0][1]!;
  expect(options.rateLimitKey).toBe('fineprint:source-agent');
  const headers = new Headers(options.headers as Headers);
  expect(headers.get('host')).toBe('fineprint.vercel.app');
  expect(headers.get('cookie')).toBeNull();
  expect(headers.get('authorization')).toBeNull();
});
it('uses the edge-provided client key for login attempts', async () => {
  check.mockResolvedValue({ rateLimited: false });
  await checkAgentLimit(request, 'login');
  expect(check.mock.calls[0][1]?.rateLimitKey).toBeUndefined();
});
it('returns 429 when the shared bucket is exhausted', async () => {
  check.mockResolvedValue({ rateLimited: true });
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ allowed: false, status: 429 });
});
it.each(['not-found', 'blocked'] as const)('fails closed on SDK error %s', async (error) => {
  check.mockResolvedValue({ rateLimited: false, error });
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ allowed: false, status: 503 });
});
it('fails closed on transport failure', async () => {
  check.mockRejectedValue(new Error('offline'));
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ allowed: false, status: 503 });
});
it.each(['FINEPRINT_RATE_LIMIT_ID', 'FINEPRINT_FIREWALL_HOST', 'RATE_LIMIT_SECRET', 'VERCEL'])(
  'rejects incomplete hosted configuration: %s',
  async (name) => {
    vi.stubEnv(name, '');
    expect(await checkAgentLimit(request, 'explain')).toMatchObject({
      allowed: false,
      status: 503,
    });
    expect(check).not.toHaveBeenCalled();
  },
);
it('rejects an arbitrary firewall destination', async () => {
  vi.stubEnv('FINEPRINT_FIREWALL_HOST', 'private.internal');
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ allowed: false, status: 503 });
  expect(check).not.toHaveBeenCalled();
});
it('does not mistake a local preview for a verified hosted rate limit', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(await checkAgentLimit(request, 'explain')).toEqual({ allowed: true });
  expect(check).not.toHaveBeenCalled();
});
