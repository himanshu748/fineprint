import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST as explain } from '../src/app/api/explain/route';
import { GET as accessState, POST as unlock, DELETE as lock } from '../src/app/api/access/route';
import { createAgentSession, sessionCookieName } from '../src/lib/agent-access';
import { examples, rulePack } from '../src/lib/rules';
const mocks = vi.hoisted(() => ({ limit: vi.fn(), load: vi.fn(), source: vi.fn() }));
vi.mock('@/lib/agent-rate-limit', () => ({ checkAgentLimit: mocks.limit }));
vi.mock('@/lib/sanity', () => ({ loadRulePack: mocks.load }));
vi.mock('@/lib/modal', () => ({ modalConfigured: () => true }));
vi.mock('@/lib/source-agent', () => ({ explainWithSources: mocks.source }));
const code = 'route-test-access-key-with-24-characters';
const base = 'https://fineprint.vercel.app';
async function request(path: string, body: unknown, authenticated = false, method = 'POST') {
  const headers = new Headers({
    origin: base,
    host: 'fineprint.vercel.app',
    'content-type': 'application/json',
  });
  if (authenticated) headers.set('cookie', `${sessionCookieName()}=${await createAgentSession()}`);
  return new Request(base + path, {
    method,
    headers,
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('FINEPRINT_REQUIRE_ACCESS_CODE', 'true');
  vi.stubEnv('FINEPRINT_AGENT_ACCESS_KEY', code);
  vi.stubEnv('FINEPRINT_SESSION_SECRET', 'route-test-session-secret-at-least-32-characters');
  vi.stubEnv('SANITY_CONTEXT_URL', 'https://api.sanity.io/context-test');
  mocks.limit.mockReset().mockResolvedValue({ allowed: true });
  mocks.load.mockReset().mockResolvedValue({ pack: rulePack, mode: 'sanity' });
  mocks.source
    .mockReset()
    .mockResolvedValue({ mode: 'live', text: 'Explanation', paths: ['source_authority'] });
});
afterEach(() => vi.unstubAllEnvs());

it('rejects anonymous source requests before either provider is called', async () => {
  const response = await explain(
    await request('/api/explain', { dossier: examples[2].dossier, ruleId: 'entry-limit' }),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ code: 'ACCESS_REQUIRED' });
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.source).not.toHaveBeenCalled();
});
it('fails closed when hosted access configuration is absent', async () => {
  vi.stubEnv('FINEPRINT_SESSION_SECRET', '');
  expect((await explain(await request('/api/explain', {}))).status).toBe(503);
  expect(mocks.source).not.toHaveBeenCalled();
});
it('rejects a cross-origin unlock', async () => {
  const req = await request('/api/access', { code });
  req.headers.set('origin', 'https://attacker.invalid');
  expect((await unlock(req)).status).toBe(403);
  expect(mocks.limit).not.toHaveBeenCalled();
});
it('unlocks with a scoped cookie, reports access, and clears it on logout', async () => {
  const response = await unlock(await request('/api/access', { code }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).not.toContain(code);
  const stateRequest = await request('/api/access', null, false, 'GET');
  stateRequest.headers.set('cookie', cookie.split(';')[0]);
  expect(await (await accessState(stateRequest)).json()).toMatchObject({ authorized: true });
  expect(
    (await lock(await request('/api/access', null, true, 'DELETE'))).headers.get('set-cookie'),
  ).toContain('Max-Age=0');
});
it('does not create a session for an incorrect access code', async () => {
  const response = await unlock(await request('/api/access', { code: 'wrong' }));
  expect(response.status).toBe(401);
  expect(response.headers.get('set-cookie')).toBeNull();
});
it('stops authenticated explanations when the shared limit cannot be verified', async () => {
  mocks.limit.mockResolvedValue({ allowed: false, status: 503, error: 'Unavailable' });
  expect(
    (
      await explain(
        await request(
          '/api/explain',
          { dossier: examples[2].dossier, ruleId: 'entry-limit' },
          true,
        ),
      )
    ).status,
  ).toBe(503);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.source).not.toHaveBeenCalled();
});
it('checks submitted facts again before requesting the explanation', async () => {
  const response = await explain(
    await request('/api/explain', { dossier: examples[2].dossier, ruleId: 'entry-limit' }, true),
  );
  expect(response.status).toBe(200);
  expect(mocks.source.mock.calls[0][1]).toMatchObject({
    status: 'unclear',
    rule: { id: 'entry-limit' },
  });
});
it('rejects oversized authenticated input before loading a rule pack', async () => {
  const response = await explain(await request('/api/explain', { text: 'x'.repeat(16_001) }, true));
  expect(response.status).toBe(413);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('does not mislabel a provider JSON failure as invalid user input', async () => {
  mocks.source.mockRejectedValue(new SyntaxError('Bad provider output'));
  expect(
    (
      await explain(
        await request(
          '/api/explain',
          { dossier: examples[2].dossier, ruleId: 'entry-limit' },
          true,
        ),
      )
    ).status,
  ).toBe(503);
});
