import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/import/route';
import { clearImportCache } from '../src/lib/rule-import';
import { modelOutput, rulesHtml } from './import-fixtures';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  reserve: vi.fn(),
  chat: vi.fn(),
  fetchPage: vi.fn(),
  realLimit: false,
}));
vi.mock('@/lib/agent-rate-limit', async (original) => {
  const actual = await original<typeof import('../src/lib/agent-rate-limit')>();
  return {
    checkAgentLimit: (...args: Parameters<typeof actual.checkAgentLimit>) =>
      mocks.realLimit ? actual.checkAgentLimit(...args) : mocks.limit(...args),
  };
});
vi.mock('@/lib/agent-budget', () => ({ reserveAgentRun: mocks.reserve }));
vi.mock('@/lib/modal', () => ({ modalConfigured: () => true, modalChat: mocks.chat }));
vi.mock('@/lib/page-fetch', async (original) => ({
  ...(await original<typeof import('../src/lib/page-fetch')>()),
  fetchPublicPage: mocks.fetchPage,
}));

const request = (body: unknown, origin = 'https://fineprint-kappa.vercel.app') =>
  new Request('https://fineprint-kappa.vercel.app/api/import', {
    method: 'POST',
    headers: { origin, host: 'fineprint-kappa.vercel.app', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const input = { url: 'https://example.devpost.com/rules' };

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'false');
  vi.stubEnv('MODAL_MODEL', 'test-model');
  clearImportCache();
  mocks.realLimit = false;
  mocks.limit.mockReset().mockResolvedValue({ allowed: true });
  mocks.reserve.mockReset().mockReturnValue(vi.fn());
  mocks.fetchPage.mockReset().mockImplementation(async (url: string) => ({
    url,
    contentType: 'text/html',
    body: rulesHtml,
  }));
  mocks.chat
    .mockReset()
    .mockResolvedValue({ role: 'assistant', content: JSON.stringify(modelOutput()) });
});
afterEach(() => vi.unstubAllEnvs());

it('imports a page, reports counts and reuses the cached result without a second model call', async () => {
  const first = await POST(request(input));
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.cached).toBe(false);
  expect(body.summary).toMatchObject({ found: 6, mapped: 4, checkYourself: 1, dropped: 1 });
  expect(body.event.host).toBe('example.devpost.com');
  const second = await (await POST(request(input))).json();
  expect(second.cached).toBe(true);
  expect(second.event.id).toBe(body.event.id);
  expect(mocks.chat).toHaveBeenCalledTimes(1);
  expect(mocks.reserve).toHaveBeenCalledTimes(1);
  expect(mocks.limit).toHaveBeenCalledTimes(2);
});

it.each([429, 503])('refuses before fetching when the shared limit returns %s', async (status) => {
  mocks.limit.mockResolvedValue({ allowed: false, status, error: 'Limited' });
  expect((await POST(request(input))).status).toBe(status);
  expect(mocks.fetchPage).not.toHaveBeenCalled();
  expect(mocks.chat).not.toHaveBeenCalled();
});

it('fails closed in production when the rate-limit configuration is missing', async () => {
  mocks.realLimit = true;
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('FINEPRINT_RATE_LIMIT_ID', '');
  const response = await POST(request(input));
  expect(response.status).toBe(503);
  expect(mocks.fetchPage).not.toHaveBeenCalled();
});

it('returns a fetch refusal as a clear error without calling the model', async () => {
  const { PageFetchError } = await import('../src/lib/page-fetch');
  mocks.fetchPage.mockRejectedValue(
    new PageFetchError('That link points to a private or local network address.'),
  );
  const response = await POST(request(input));
  expect(response.status).toBe(422);
  expect((await response.json()).error).toContain('private');
  expect(mocks.chat).not.toHaveBeenCalled();
});

it('rejects malformed model output with no partial pack', async () => {
  mocks.chat.mockResolvedValue({
    role: 'assistant',
    content: JSON.stringify({ event: { name: 'X' }, requirements: 'all good' }),
  });
  const response = await POST(request(input));
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body.event).toBeUndefined();
  expect(body.error).toContain('Nothing was imported');
});

it('refuses cross-origin requests and too many extra pages', async () => {
  expect((await POST(request(input, 'https://elsewhere.invalid'))).status).toBe(403);
  expect(
    (await POST(request({ ...input, extra: ['https://a.b/1', 'https://a.b/2', 'https://a.b/3'] })))
      .status,
  ).toBe(400);
  expect(mocks.fetchPage).not.toHaveBeenCalled();
});

it('hides provider error details', async () => {
  mocks.chat.mockRejectedValue(new Error('provider-secret-detail'));
  const response = await POST(request(input));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('provider-secret');
  expect(mocks.reserve.mock.results[0].value).toHaveBeenCalledOnce();
});
