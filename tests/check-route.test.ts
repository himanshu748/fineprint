import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/check/route';
import { newReview } from '../src/lib/review-workspace';
import { reportSchema } from '../src/lib/model';
import { rulePack } from '../src/lib/rules';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/sanity', () => ({ loadRulePack: mocks.load }));
const base = 'https://fineprint-kappa.vercel.app';
const request = (body: string, origin = base) =>
  new Request(base + '/api/check', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body,
  });
const draft = () => newReview('Personal project', 'path-two').dossier;
beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({ pack: rulePack, mode: 'sanity' });
});
it('checks personal facts without AI or an account', async () => {
  const response = await POST(request(JSON.stringify(draft())));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const report = reportSchema.parse(await response.json());
  expect(report.dossier.name).toBe('Personal project');
  expect(report.counts.missing).toBeGreaterThan(0);
});
it.each([
  ['foreign origin', '{}', 'https://elsewhere.invalid', 403],
  ['oversized body', 'x'.repeat(16_001), base, 413],
  ['invalid JSON', '{', base, 400],
  ['unfinished facts', JSON.stringify({ ...draft(), name: '', startedAt: '2026-0' }), base, 400],
] as const)('rejects %s before loading rules', async (_, body, origin, status) => {
  expect((await POST(request(body, origin))).status).toBe(status);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('offers an explicit dated-rule fallback on source failure without fabricating a report', async () => {
  mocks.load.mockRejectedValue(new Error('private provider details'));
  const response = await POST(request(JSON.stringify(draft())));
  expect(response.status).toBe(503);
  const result = await response.json();
  expect(result.error).toContain('dated saved rules');
  expect(JSON.stringify(result)).not.toContain('private provider');
  expect(result).not.toHaveProperty('findings');
});
