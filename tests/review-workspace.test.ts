import { describe, expect, it, vi } from 'vitest';
import {
  emptyWorkspace,
  exportWorkspace,
  importWorkspace,
  maxBackupBytes,
  maxReviews,
  mergeAnswerFacts,
  newReview,
  nextFact,
  persistWorkspace,
  reviewIsStale,
  updateReview,
  workspaceKey,
  workspaceSchema,
  type ReviewWorkspace,
} from '../src/lib/review-workspace';
import { dossierSchema } from '../src/lib/model';
import { checkDossier } from '../src/lib/engine';
import { rulePack } from '../src/lib/rules';
import type { AskResponse } from '../src/lib/agent-schema';

const setup = (): ReviewWorkspace => {
  const review = newReview('Kitchen notebook', 'path-two');
  return { version: 1, activeId: review.id, reviews: [review] };
};

describe('personal drafts', () => {
  it('does not assume eligibility facts when a visitor creates a review', () => {
    const { dossier, report } = newReview('My project', 'path-one');
    expect(report).toBeNull();
    for (const [key, value] of Object.entries(dossier)) {
      if (!['name', 'track', 'evidenceNote'].includes(key)) expect(value, key).toBeNull();
    }
  });
  it('saves unfinished input without claiming it passed validation', () => {
    const current = setup();
    const review = current.reviews[0];
    const draft = { ...review.dossier, name: '', startedAt: '2026-0', teamSize: 0 };
    const saved = updateReview(current, review.id, { dossier: draft });
    const restored = workspaceSchema.parse(JSON.parse(JSON.stringify(saved)));
    expect(restored.reviews[0].dossier).toEqual(draft);
    expect(dossierSchema.safeParse(draft).success).toBe(false);
    expect(current.reviews[0].dossier.name).toBe('Kitchen notebook');
  });
  it('marks a report stale when its facts are edited and isolates other reviews', () => {
    const current = setup();
    const first = current.reviews[0];
    first.report = checkDossier(first.dossier, rulePack);
    const second = newReview('Other project', 'path-one');
    current.reviews.push(second);
    const next = updateReview(current, first.id, {
      dossier: { ...first.dossier, usesSanity: true },
    });
    expect(reviewIsStale(next.reviews[0])).toBe(true);
    expect(next.reviews[1]).toBe(second);
    expect(updateReview(next, first.id, { dossier: next.reviews[0].dossier })).toBe(next);
  });
  it('only guides visitors to editable missing facts', () => {
    const report = checkDossier(newReview('My project', 'path-one').dossier, rulePack);
    const next = nextFact(report);
    expect(next).not.toBeNull();
    expect(next?.field).toBe('teamSize');
    expect(next?.question).toBeTruthy();
    expect(nextFact(null)).toBeNull();
  });
});

describe('portable backups', () => {
  it('restores declared facts and requires a new check instead of importing verdicts', () => {
    const current = setup();
    current.reviews[0].report = checkDossier(current.reviews[0].dossier, rulePack);
    current.reviews[0].question = 'Private question not included in facts-only backups';
    const raw = exportWorkspace(current);
    expect(raw).not.toContain('Private question');
    expect(JSON.parse(raw).reviews[0]).not.toHaveProperty('report');
    const result = importWorkspace(raw, emptyWorkspace());
    expect(result.imported).toBe(1);
    expect(result.workspace.reviews[0].dossier).toEqual(current.reviews[0].dossier);
    expect(result.workspace.reviews[0].report).toBeNull();
    expect(result.workspace.reviews[0].answer).toBeNull();
  });
  it('preserves both versions on an ID conflict and deduplicates repeated imports', () => {
    const current = setup();
    const oldBackup = exportWorkspace(current);
    const edited = updateReview(current, current.activeId!, {
      dossier: { ...current.reviews[0].dossier, name: 'New name' },
    });
    const result = importWorkspace(oldBackup, edited);
    expect(result.imported).toBe(1);
    expect(result.workspace.reviews.map((r) => r.dossier.name)).toEqual([
      'New name',
      'Kitchen notebook',
    ]);
    expect(new Set(result.workspace.reviews.map((r) => r.id)).size).toBe(2);
    expect(importWorkspace(oldBackup, result.workspace).imported).toBe(0);
    expect(edited.reviews).toHaveLength(1);
  });
  it.each(['invalid-json', 'wrong-event', 'embedded-report'])(
    'rejects %s without replacing work',
    (kind) => {
      const current = setup();
      const before = JSON.stringify(current);
      const backup = JSON.parse(exportWorkspace(current));
      if (kind === 'wrong-event') backup.event = 'another-event';
      if (kind === 'embedded-report') backup.reviews[0].report = { summary: 'Everything passed' };
      expect(() =>
        importWorkspace(kind === 'invalid-json' ? '{' : JSON.stringify(backup), current),
      ).toThrow('existing reviews have not changed');
      expect(JSON.stringify(current)).toBe(before);
    },
  );
  it('rejects a capacity-overflowing import atomically', () => {
    const current = setup();
    current.reviews = Array.from({ length: maxReviews }, (_, i) =>
      newReview(`Project ${i}`, 'path-one'),
    );
    current.activeId = null;
    const incoming = exportWorkspace(setup());
    expect(() => importWorkspace(incoming, current)).toThrow('No reviews were imported');
    expect(current.reviews).toHaveLength(maxReviews);
  });
  it('limits UTF-8 bytes rather than character count', () => {
    expect(() => importWorkspace('é'.repeat(maxBackupBytes / 2 + 1), setup())).toThrow('too large');
  });
});

describe('durable local saving', () => {
  it('will not overwrite another tab’s newer workspace', () => {
    const storage = { getItem: vi.fn(() => 'newer saved data'), setItem: vi.fn() };
    expect(() => persistWorkspace(storage, setup(), 'older data')).toThrow('another tab');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('surfaces quota errors and leaves the in-memory workspace untouched', () => {
    const current = setup();
    const before = JSON.stringify(current);
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => persistWorkspace(storage, current, null)).toThrow('quota');
    expect(JSON.stringify(current)).toBe(before);
  });
  it('validates active-review references and writes a reloadable workspace', () => {
    const storage = { getItem: () => null, setItem: vi.fn() };
    const current = setup();
    const raw = persistWorkspace(storage, current, null);
    expect(storage.setItem).toHaveBeenCalledWith(workspaceKey, raw);
    expect(workspaceSchema.parse(JSON.parse(raw))).toEqual(current);
    current.reviews[0].archived = true;
    expect(() => persistWorkspace(storage, current, null)).toThrow('active review');
  });
});

it('merges only valid stated agent facts, preserving names, notes, and unanswered fields', () => {
  const current = {
    ...newReview('My name', 'path-one').dossier,
    evidenceNote: 'My private note',
    usesKnowledgeBase: true,
    teamSize: 2,
  };
  const answer = {
    report: checkDossier({ ...current, track: 'path-two' }, rulePack),
    facts: [
      { key: 'usesSanity', status: 'stated', value: true },
      { key: 'usesKnowledgeBase', status: 'unknown', value: null },
      { key: 'teamSize', status: 'stated', value: 'a crowd' },
      { key: 'name', status: 'stated', value: 'Agent name' },
      { key: 'evidenceNote', status: 'stated', value: 'Replace notes' },
      { key: '__proto__', status: 'stated', value: 'unrecognized' },
    ],
  } as unknown as AskResponse;
  expect(mergeAnswerFacts(current, answer)).toEqual({
    ...current,
    track: 'path-two',
    usesSanity: true,
  });
});
