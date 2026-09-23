import { beforeEach, it, expect, vi } from 'vitest';
import { POST } from '../src/app/api/repository-review/route';
const mocks = vi.hoisted(() => ({
  assess: vi.fn(),
  access: vi.fn(),
  limit: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
}));
vi.mock('@/lib/repository-assessment', () => ({ assessRepository: mocks.assess }));
vi.mock('@/lib/agent-access', () => ({ agentAccess: mocks.access }));
vi.mock('@/lib/agent-rate-limit', () => ({ checkAgentLimit: mocks.limit }));
vi.mock('@/lib/agent-budget', () => ({ reserveAgentRun: mocks.reserve }));
const origin = 'https://fineprint-kappa.vercel.app';
const body = { repository: 'https://github.com/team/project', rubricId: 'sanity-path-one' };
const req = (value: unknown = body, site = origin) =>
  new Request(origin + '/api/repository-review', {
    method: 'POST',
    headers: { Origin: site, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ available: true, authorized: true });
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.reserve.mockReturnValue(mocks.release);
  mocks.assess.mockResolvedValue({ ok: true });
});
it('blocks other origins and invalid GitHub URLs before spending the allowance', async () => {
  expect((await POST(req(body, 'https://evil.test'))).status).toBe(403);
  expect((await POST(req({ ...body, repository: 'https://127.0.0.1/secret' }))).status).toBe(400);
  expect(mocks.limit).not.toHaveBeenCalled();
  expect(mocks.assess).not.toHaveBeenCalled();
});
it('enforces agent access and shared rate limits', async () => {
  mocks.access.mockResolvedValueOnce({ available: true, authorized: false });
  expect((await POST(req())).status).toBe(401);
  mocks.limit.mockResolvedValueOnce({ allowed: false, status: 429, error: 'Try later' });
  expect((await POST(req())).status).toBe(429);
  expect(mocks.assess).not.toHaveBeenCalled();
});
it('does not leak provider errors and releases the concurrency slot', async () => {
  mocks.assess.mockRejectedValueOnce(new Error('private prompt content'));
  const r = await POST(req());
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain('private prompt');
  expect(mocks.release).toHaveBeenCalledOnce();
});
it('rejects unknown rubrics and oversized requests', async () => {
  expect((await POST(req({ ...body, rubricId: 'fake-event' }))).status).toBe(400);
  expect((await POST(req({ x: 'a'.repeat(2100) }))).status).toBe(413);
  expect(mocks.assess).not.toHaveBeenCalled();
});
