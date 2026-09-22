import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/ask/route';
import { rulePack } from '../src/lib/rules';
const mocks = vi.hoisted(() => ({ limit: vi.fn(), load: vi.fn(), ask: vi.fn(), reserve: vi.fn() }));
vi.mock('@/lib/agent-rate-limit', () => ({ checkAgentLimit: mocks.limit }));
vi.mock('@/lib/sanity', () => ({ loadRulePack: mocks.load }));
vi.mock('@/lib/modal', () => ({ modalConfigured: () => true }));
vi.mock('@/lib/agent-budget', () => ({ reserveAgentRun: mocks.reserve }));
vi.mock('@/lib/question-agent', async (original) => ({
  ...(await original<typeof import('../src/lib/question-agent')>()),
  askWithSources: mocks.ask,
}));
const request = (body: unknown, origin = 'https://fineprint-kappa.vercel.app') =>
  new Request('https://fineprint-kappa.vercel.app/api/ask', {
    method: 'POST',
    headers: { origin, host: 'fineprint-kappa.vercel.app', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const input = { question: 'I started my app in August. Can I enter?', track: 'path-one' };
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'false');
  vi.stubEnv('SANITY_CONTEXT_URL', 'https://api.sanity.io/test');
  vi.stubEnv('SANITY_CONTEXT_TOKEN', 'test-only');
  mocks.limit.mockReset().mockResolvedValue({ allowed: true });
  mocks.load.mockReset().mockResolvedValue({ pack: rulePack, mode: 'sanity' });
  mocks.ask.mockReset().mockResolvedValue({ mode: 'live' });
  mocks.reserve.mockReset().mockReturnValue(vi.fn());
});
afterEach(() => vi.unstubAllEnvs());
it('allows a public question without inheriting illustrative dossier facts', async () => {
  const response = await POST(request(input));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.ask.mock.calls[0][1]).toMatchObject({
    adultTeam: null,
    entriesPerPath: null,
    usesContext: null,
    seeksMultiplePrizes: null,
  });
});
it.each([429, 503])('refuses work when the shared limit returns %s', async (status) => {
  mocks.limit.mockResolvedValue({ allowed: false, status, error: 'Unavailable' });
  expect((await POST(request(input))).status).toBe(status);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.ask).not.toHaveBeenCalled();
});
it('retains the optional access-code deployment mode', async () => {
  vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'true');
  vi.stubEnv('FINEPRINT_AGENT_ACCESS_KEY', 'test-access-key-at-least-24-characters');
  vi.stubEnv('FINEPRINT_SESSION_SECRET', 'test-session-secret-at-least-32-characters');
  expect((await POST(request(input))).status).toBe(401);
  expect(mocks.limit).not.toHaveBeenCalled();
});
it('rejects cross-origin and oversized requests before providers', async () => {
  expect((await POST(request(input, 'https://elsewhere.invalid'))).status).toBe(403);
  expect((await POST(request({ ...input, question: 'x'.repeat(16_001) }))).status).toBe(413);
  expect(mocks.ask).not.toHaveBeenCalled();
});
it('does not turn provider failure into a successful local answer', async () => {
  mocks.ask.mockRejectedValue(new Error('sensitive provider details'));
  const response = await POST(request(input));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('sensitive');
  expect(mocks.reserve.mock.results[0].value).toHaveBeenCalledOnce();
});
