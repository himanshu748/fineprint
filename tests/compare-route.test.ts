import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/compare/route';
import { GET } from '../src/app/api/events/route';
import { savedPacks } from '../src/lib/events';
import { blankDossier } from '../src/lib/rules';
import type { EventId } from '../src/lib/model';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/sanity', () => ({ loadRulePack: mocks.load }));
const url = 'https://fineprint-kappa.vercel.app/api/compare';
const request = (body: unknown, origin = 'https://fineprint-kappa.vercel.app') =>
  new Request(url, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() =>
  mocks.load.mockReset().mockImplementation(async (eventId: EventId) => ({
    pack: savedPacks[eventId],
    mode: 'sanity',
  })),
);
it('returns two event-bound reports with one check timestamp and no inherited restrictions', async () => {
  const response = await POST(request({ ...blankDossier, teamSize: 5, eligibleResidency: true }));
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(data.reports.map((r: { packId: string }) => r.packId)).toEqual([
    'sanity-2026',
    'gibc-v2-2026',
  ]);
  expect(data.reports[0].checkedAt).toBe(data.reports[1].checkedAt);
  expect(data.reports[1].dossier.eligibleResidency).toBeNull();
});
it('reports a missing pack without fabricating its result or exposing provider details', async () => {
  mocks.load.mockImplementation(async (id: EventId) => {
    if (id === 'gibc-v2-2026') throw new Error('private provider detail');
    return { pack: savedPacks[id], mode: 'sanity' };
  });
  const data = await (await POST(request(blankDossier))).json();
  expect(data.reports).toHaveLength(1);
  expect(data.unavailable).toEqual(['gibc-v2-2026']);
  expect(JSON.stringify(data)).not.toContain('private provider');
  const catalog = await (await GET()).json();
  expect(catalog.events).toHaveLength(1);
  expect(catalog.unavailable).toEqual(['gibc-v2-2026']);
});
it('rejects incompatible event and track before fetching', async () => {
  expect((await POST(request({ ...blankDossier, eventId: 'gibc-v2-2026' }))).status).toBe(400);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('rejects unknown events before fetching', async () => {
  expect((await POST(request({ ...blankDossier, eventId: 'arbitrary-event' }))).status).toBe(400);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('rejects cross-origin comparisons', async () => {
  expect((await POST(request(blankDossier, 'https://other.invalid'))).status).toBe(403);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('bounds the streamed comparison request', async () => {
  expect(
    (
      await POST(
        new Request(url, {
          method: 'POST',
          headers: { origin: 'https://fineprint-kappa.vercel.app' },
          body: 'x'.repeat(16_001),
        }),
      )
    ).status,
  ).toBe(413);
  expect(mocks.load).not.toHaveBeenCalled();
});
