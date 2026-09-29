import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@vercel/firewall';
import { checkAgentLimit } from '../src/lib/agent-rate-limit';
vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));
const check = vi.mocked(checkRateLimit);
const now = new Date('2026-09-29T12:01:00Z');
const request = new Request('https://fineprint.vercel.app/api/explain', {
  headers: {
    host: 'attacker.invalid',
    'x-real-ip': '192.0.2.1',
    cookie: 'private-session',
    authorization: 'private-credential',
  },
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('FINEPRINT_RATE_LIMIT_ID', 'fineprint-demo');
  vi.stubEnv('FINEPRINT_FIREWALL_HOST', 'fineprint.vercel.app');
  vi.stubEnv('RATE_LIMIT_SECRET', 'test-rate-limit-secret-32-characters');
  check.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function useFiveCreditBuckets() {
  const debits = new Map<string, number>();
  check.mockImplementation(async (_id, options) => {
    const key = options!.rateLimitKey!;
    const count = (debits.get(key) ?? 0) + 1;
    debits.set(key, count);
    return { rateLimited: count > 5 };
  });
  return debits;
}

it('checks the client twice before the unchanged shared key and forwards no credentials or untrusted host', async () => {
  check.mockResolvedValue({ rateLimited: false });
  expect(await checkAgentLimit(request, 'explain')).toEqual({ allowed: true });
  expect(check.mock.calls.map(([id]) => id)).toEqual(Array(3).fill('fineprint-demo'));
  const clientKey = check.mock.calls[0][1]?.rateLimitKey;
  expect(clientKey).toBe(`fineprint:client:${Math.floor(now.getTime() / 600_000)}:192.0.2.1`);
  expect(check.mock.calls[1][1]?.rateLimitKey).toBe(clientKey);
  const options = check.mock.calls[2][1]!;
  expect(options.rateLimitKey).toBe('fineprint:source-agent');
  const headers = new Headers(options.headers as Headers);
  expect(headers.get('host')).toBe('fineprint.vercel.app');
  expect(headers.get('x-real-ip')).toBe('192.0.2.1');
  expect(headers.get('cookie')).toBeNull();
  expect(headers.get('authorization')).toBeNull();
});
it.each(['login', 'read'] as const)(
  'charges %s twice without spending model allowance',
  async (action) => {
    check.mockResolvedValue({ rateLimited: false });
    expect(await checkAgentLimit(request, action)).toEqual({ allowed: true });
    expect(check).toHaveBeenCalledTimes(2);
    expect(
      check.mock.calls.every(([, options]) =>
        options?.rateLimitKey?.startsWith('fineprint:client:'),
      ),
    ).toBe(true);
  },
);
it('spends only the shared credit for a model run after an import cache miss', async () => {
  check.mockResolvedValue({ rateLimited: false });
  expect(await checkAgentLimit(request, 'model')).toEqual({ allowed: true });
  expect(check).toHaveBeenCalledTimes(1);
  expect(check.mock.calls[0][1]?.rateLimitKey).toBe('fineprint:source-agent');
});
it('admits two sequential requests and rejects a third before the shared allowance', async () => {
  const debits = useFiveCreditBuckets();
  expect(await checkAgentLimit(request, 'explain')).toEqual({ allowed: true });
  expect(await checkAgentLimit(request, 'explain')).toEqual({ allowed: true });
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ status: 429 });
  expect(debits.get('fineprint:source-agent')).toBe(2);
});
it('keeps concurrent partial debits inside the client allowance', async () => {
  const debits = useFiveCreditBuckets();
  const results = await Promise.all(
    Array.from({ length: 3 }, () => checkAgentLimit(request, 'explain')),
  );
  expect(results.filter((result) => result.allowed)).toHaveLength(2);
  expect(results.filter((result) => !result.allowed)).toEqual([
    expect.objectContaining({ status: 429 }),
  ]);
  expect(debits.get('fineprint:source-agent')).toBe(2);
});
it('keeps different clients independent while retaining one shared model cap', async () => {
  const debits = useFiveCreditBuckets();
  for (let client = 1; client <= 3; client++) {
    const req = new Request(request);
    req.headers.set('x-real-ip', `192.0.2.${client}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await checkAgentLimit(req, 'explain');
      expect(result).toMatchObject(
        client === 3 && attempt === 1 ? { status: 429 } : { allowed: true },
      );
    }
  }
  expect(debits.get('fineprint:source-agent')).toBe(6);
  expect([...debits.keys()].filter((key) => key.startsWith('fineprint:client:'))).toHaveLength(3);
});
it('returns 429 when the shared bucket is exhausted', async () => {
  check
    .mockResolvedValueOnce({ rateLimited: false })
    .mockResolvedValueOnce({ rateLimited: false })
    .mockResolvedValueOnce({ rateLimited: true });
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ allowed: false, status: 429 });
  expect(check).toHaveBeenCalledTimes(3);
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
it.each([1, 2])(
  'does not spend shared allowance when client debit %s is limited',
  async (debit) => {
    if (debit === 2) check.mockResolvedValueOnce({ rateLimited: false });
    check.mockResolvedValue({ rateLimited: true });
    expect(await checkAgentLimit(request, 'explain')).toMatchObject({ status: 429 });
    expect(check).toHaveBeenCalledTimes(debit);
    expect(
      check.mock.calls.every(([, options]) => options?.rateLimitKey !== 'fineprint:source-agent'),
    ).toBe(true);
  },
);
it.each([1, 2])(
  'rejects a client window change during debit %s before any later debit',
  async (debit) => {
    vi.setSystemTime(new Date('2026-09-29T12:09:59Z'));
    if (debit === 2) check.mockResolvedValueOnce({ rateLimited: false });
    check.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2026-09-29T12:10:00Z'));
      return { rateLimited: false };
    });
    expect(await checkAgentLimit(request, 'explain')).toMatchObject({ status: 503 });
    expect(check).toHaveBeenCalledTimes(debit);
  },
);
it('uses a new client key for the next application window', async () => {
  check.mockResolvedValue({ rateLimited: false });
  expect(await checkAgentLimit(request, 'read')).toEqual({ allowed: true });
  const firstKey = check.mock.calls[0][1]?.rateLimitKey;
  vi.setSystemTime(new Date(now.getTime() + 600_000));
  expect(await checkAgentLimit(request, 'read')).toEqual({ allowed: true });
  expect(check.mock.calls[2][1]?.rateLimitKey).not.toBe(firstKey);
});
it.each([1, 2])('never resumes debits after timing out during client debit %s', async (debit) => {
  let finish!: (result: { rateLimited: boolean }) => void;
  if (debit === 2) check.mockResolvedValueOnce({ rateLimited: false });
  check.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const result = checkAgentLimit(request, 'explain');
  await vi.advanceTimersByTimeAsync(5000);
  expect(await result).toMatchObject({ status: 503 });
  finish({ rateLimited: false });
  await vi.advanceTimersByTimeAsync(0);
  expect(check).toHaveBeenCalledTimes(debit);
});
it('checks the deadline even before the timer callback can run', async () => {
  check.mockImplementationOnce(async () => {
    vi.setSystemTime(new Date(now.getTime() + 5000));
    return { rateLimited: false };
  });
  expect(await checkAgentLimit(request, 'explain')).toMatchObject({ status: 503 });
  expect(check).toHaveBeenCalledTimes(1);
});
it.each([undefined, 'not-an-ip'])(
  'fails closed without a valid edge client IP (%s)',
  async (ip) => {
    const req = new Request(request);
    if (ip) req.headers.set('x-real-ip', ip);
    else req.headers.delete('x-real-ip');
    expect(await checkAgentLimit(req, 'explain')).toMatchObject({ status: 503 });
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
