import { describe, expect, it } from 'vitest';
import { checkDossier, changedFindings } from '../src/lib/engine';
import { eventPhase, factsForEvent, savedPacks } from '../src/lib/events';
import { blankDossier, examples, rulePack, rulePackSeptember20 } from '../src/lib/rules';
import { gibcRulePack } from '../src/lib/gibc-rules';
import { ruleImpact } from '../src/lib/rule-impact';
import { validateRulePack } from '../src/lib/sanity';
import { dossierSchema } from '../src/lib/model';
import {
  emptyWorkspace,
  exportWorkspace,
  importWorkspace,
  newReview,
  workspaceSchema,
} from '../src/lib/review-workspace';
const now = '2026-09-22T08:00:00.000Z';
const facts = {
  ...blankDossier,
  name: 'Five-person prototype',
  startedAt: '2026-08-23',
  teamSize: 5,
  origin: 'existing' as const,
  eligibleResidency: true,
  excludedAffiliation: false,
  allStudents: true,
};
const gibc = factsForEvent(facts, 'gibc-v2-2026');
const status = (pack: typeof rulePack, dossier: typeof facts | typeof gibc, id: string) =>
  checkDossier(dossier, pack, now).findings.find((finding) => finding.rule.id === id)!.status;

describe('separate event decisions', () => {
  it.each(Object.values(savedPacks))('validates the curated $id pack', (pack) =>
    expect(validateRulePack(pack)).toEqual(pack),
  );
  it('keeps team size and dates comparable without transferring event declarations', () => {
    expect(gibc).toMatchObject({
      name: facts.name,
      teamSize: 5,
      startedAt: '2026-08-23',
      allStudents: true,
      origin: null,
      eligibleResidency: null,
      excludedAffiliation: null,
      track: 'open-invention',
      entriesPerPath: null,
      publishedPost: null,
    });
    expect(status(rulePack, facts, 'team')).toBe('blocked');
    expect(status(gibcRulePack, gibc, 'gibc-team')).toBe('supported');
    expect(status(rulePack, facts, 'start')).toBe('blocked');
    expect(status(gibcRulePack, gibc, 'gibc-start')).toBe('supported');
    expect(status(gibcRulePack, gibc, 'gibc-origin')).toBe('missing');
  });
  it('does not mutate the original facts', () => {
    factsForEvent(facts, 'gibc-v2-2026');
    expect(facts.eventId).toBe('sanity-2026');
    expect(facts.eligibleResidency).toBe(true);
  });
  it('keeps the selected event’s facts intact', () =>
    expect(factsForEvent(facts, 'sanity-2026')).toEqual(facts));
  it('refuses another event’s pack or an incompatible track', () => {
    expect(() => checkDossier(facts, gibcRulePack, now)).toThrow('match');
    expect(() => checkDossier({ ...gibc, track: 'both' }, gibcRulePack, now)).toThrow('match');
  });
  it('keeps unknown student and age declarations unknown', () => {
    const unknown = { ...gibc, allStudents: null, minimumAge: null };
    expect(status(gibcRulePack, unknown, 'gibc-students')).toBe('missing');
    expect(status(gibcRulePack, unknown, 'gibc-age')).toBe('missing');
    expect(status(gibcRulePack, unknown, 'gibc-guardian')).toBe('missing');
  });
  it('checks guardian applicability and one-project restriction separately', () => {
    expect(status(gibcRulePack, { ...gibc, minimumAge: 18 }, 'gibc-guardian')).toBe(
      'not-applicable',
    );
    expect(
      status(gibcRulePack, { ...gibc, minimumAge: 17, guardianConsent: false }, 'gibc-guardian'),
    ).toBe('unclear');
    expect(
      status(gibcRulePack, { ...gibc, oneTeam: true, entriesPerPath: 2 }, 'gibc-one-team'),
    ).toBe('blocked');
  });
  it('uses the event’s UTC deadline, including the exact boundary', () => {
    expect(
      checkDossier(gibc, gibcRulePack, '2026-10-01T15:45:00.000Z').findings.at(-1)?.status,
    ).toBe('supported');
    expect(
      checkDossier(gibc, gibcRulePack, '2026-10-01T15:45:00.001Z').findings.at(-1)?.status,
    ).toBe('blocked');
    expect(eventPhase(gibcRulePack, Date.parse('2026-10-02'))).toBe('Closed');
  });
  it('does not permit a cross-event source host', () => {
    expect(() => validateRulePack({ ...gibcRulePack, sources: rulePack.sources })).toThrow(
      'unapproved',
    );
  });
});

describe('specific rule change impact', () => {
  const report = checkDossier(gibc, gibcRulePack, now);
  const clone = () => structuredClone(gibcRulePack);
  it('does not label a version-only or capture-date refresh as a changed rule', () => {
    const pack = clone();
    pack.version = '2026-09-23.1';
    pack.sources[0].capturedAt = '2026-09-23';
    expect(ruleImpact(report, pack)).toMatchObject({
      versionChanged: true,
      needsRecheck: false,
      changes: [],
    });
    expect(changedFindings(report, checkDossier(gibc, pack, now))).toEqual([]);
  });
  it('finds only the changed team rule, even if its resulting status is unchanged', () => {
    const pack = clone();
    pack.version = 'rehearsal';
    pack.requirements[0].check = { op: 'lte', fact: 'teamSize', value: 5 };
    expect(ruleImpact(report, pack)?.changes.map((change) => change.id)).toEqual(['gibc-team']);
    expect(status(pack, gibc, 'gibc-team')).toBe('supported');
  });
  it('reports added and removed requirements', () => {
    const pack = clone();
    const removed = pack.requirements.shift()!;
    pack.requirements.push({ ...removed, id: 'gibc-new-rule' });
    expect(ruleImpact(report, pack)?.changes.map((c) => [c.id, c.kind])).toEqual([
      ['gibc-new-rule', 'added'],
      ['gibc-team', 'removed'],
    ]);
  });
  it('traces a source edit only to requirements referencing that source', () => {
    const pack = clone();
    pack.sources[1].summary += ' Clarification.';
    const expected = pack.requirements
      .filter((r) => r.sources.includes('gibc-overview'))
      .map((r) => r.id);
    expect(ruleImpact(report, pack)?.changes.map((c) => c.id)).toEqual(expected);
    expect(expected).not.toContain('gibc-team');
  });
  it('tracks a changed deadline used by conditions', () => {
    const pack = clone();
    pack.deadline = '2026-10-03T15:45:00.000Z';
    expect(ruleImpact(report, pack)?.changes.map((c) => c.id)).toEqual([
      'gibc-start',
      'gibc-deadline',
    ]);
  });
  it('never compares rule history across unrelated events', () =>
    expect(ruleImpact(report, rulePack)).toBeNull());
  it('shows the September 24 entry limit as a rule change to a saved two-entry review', () => {
    const saved = checkDossier(examples[2].dossier, rulePackSeptember20, '2026-09-22T08:00:00Z');
    const current = checkDossier(examples[2].dossier, rulePack, '2026-09-24T12:00:00Z');
    const limit = (report: typeof saved) =>
      report.findings.find((finding) => finding.rule.id === 'entry-limit')!.status;
    expect([limit(saved), limit(current)]).toEqual(['unclear', 'blocked']);
    const impact = ruleImpact(saved, rulePack)!;
    expect(impact).toMatchObject({ from: '2026-09-20.1', to: '2026-09-24.1', needsRecheck: true });
    expect(impact.changes.find((change) => change.id === 'entry-limit')).toMatchObject({
      kind: 'changed',
      detail: 'Requirement and linked source content changed.',
    });
    expect(
      impact.changes.every((change) =>
        rulePack.requirements.find((rule) => rule.id === change.id)!.sources.includes('contest'),
      ),
    ).toBe(true);
  });
  it('ignores object key order from API serialization', () => {
    const pack = clone();
    pack.requirements[0] = Object.fromEntries(
      Object.entries(pack.requirements[0]).reverse(),
    ) as (typeof pack.requirements)[0];
    expect(ruleImpact(report, pack)?.changes).toEqual([]);
  });
});

describe('existing users and portable backups', () => {
  it('migrates old dossiers and reports without losing the project', () => {
    const review = newReview('Existing personal project', 'path-one');
    const legacy = JSON.parse(JSON.stringify(review));
    delete legacy.dossier.eventId;
    for (const key of [
      'allStudents',
      'minimumAge',
      'guardianConsent',
      'oneTeam',
      'workingPrototype',
      'technicalNovelty',
      'priorHackathonEntry',
      'publicRepository',
      'setupInstructions',
      'videoMinutes',
      'videoAccessible',
      'screenshotsCount',
      'devpostComplete',
      'aiUseDisclosed',
    ])
      delete legacy.dossier[key];
    const parsed = workspaceSchema.parse({ version: 1, activeId: legacy.id, reviews: [legacy] });
    expect(parsed.reviews[0].dossier).toMatchObject({
      eventId: 'sanity-2026',
      name: 'Existing personal project',
      minimumAge: null,
    });
    expect(dossierSchema.safeParse(parsed.reviews[0].dossier).success).toBe(true);
  });
  it('round trips both events through a facts-only backup', () => {
    const reviews = [newReview('One', 'path-one'), newReview('Two', 'open-invention', gibc)];
    const imported = importWorkspace(
      exportWorkspace({ ...emptyWorkspace(), reviews }),
      emptyWorkspace(),
    );
    expect(imported.imported).toBe(2);
    expect(imported.workspace.reviews.map((r) => r.dossier.eventId)).toEqual([
      'sanity-2026',
      'gibc-v2-2026',
    ]);
    expect(imported.workspace.reviews.every((r) => r.report === null)).toBe(true);
  });
});
