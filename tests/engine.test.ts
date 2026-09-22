import { describe, expect, it } from 'vitest';
import { checkDossier, changedFindings, reportMarkdown } from '../src/lib/engine';
import { dossierSchema } from '../src/lib/model';
import { examples, rulePack } from '../src/lib/rules';
import { evaluationClock, scenarios } from '../src/lib/scenarios';
import { validateRulePack } from '../src/lib/sanity';

describe('reviewed behavior fixtures', () => {
  for (const scenario of scenarios)
    it(scenario.name, () => {
      const dossier = dossierSchema.parse({ ...examples[0].dossier, ...scenario.patch });
      const report = checkDossier(dossier, rulePack, scenario.clock ?? evaluationClock);
      expect(report.findings.find((f) => f.rule.id === scenario.rule)?.status).toBe(
        scenario.expected,
      );
    });
});
describe('report invariants', () => {
  it('a prize language failure does not become an entry failure', () => {
    const report = checkDossier(
      { ...examples[0].dossier, englishSubmission: false },
      rulePack,
      evaluationClock,
    );
    expect(report.summary).toBe('No blockers in covered eligibility checks');
    expect(report.findings.find((f) => f.rule.id === 'english')?.rule.scope).toBe('prize');
  });
  it('every result retains known sources', () => {
    const report = checkDossier(examples[0].dossier, rulePack, evaluationClock);
    for (const finding of report.findings)
      for (const source of finding.rule.sources)
        expect(report.sources.some((s) => s.id === source)).toBe(true);
  });
  it('changing project origin highlights only dependent findings', () => {
    const before = checkDossier(
      { ...examples[0].dossier, origin: 'new' },
      rulePack,
      evaluationClock,
    );
    const after = checkDossier(
      { ...examples[0].dossier, origin: 'existing' },
      rulePack,
      evaluationClock,
    );
    expect(changedFindings(before, after).sort()).toEqual(['origin', 'credit', 'new-work'].sort());
  });
  it('flags stale snapshots instead of implying current rules', () => {
    const report = checkDossier(examples[0].dossier, rulePack, '2026-09-29T12:00:00Z');
    expect(report.sourceHealth).toBe('aging-snapshot');
  });
  it('exports provenance and limitations with each report', () => {
    const text = reportMarkdown(checkDossier(examples[0].dossier, rulePack, evaluationClock));
    expect(text).toContain('2026-09-20.1');
    expect(text).toContain('not independently verified');
    expect(text).toContain('https://dev.to/page/official-hackathon-rules');
  });
  it('rejects malformed facts rather than coercing them', () => {
    expect(dossierSchema.safeParse({ ...examples[0].dossier, teamSize: '4' }).success).toBe(false);
    expect(dossierSchema.safeParse({ ...examples[0].dossier, adultTeam: 'yes' }).success).toBe(
      false,
    );
    expect(dossierSchema.safeParse({ ...examples[0].dossier, startedAt: 'tomorrow' }).success).toBe(
      false,
    );
  });
  it('rejects a rule pack with invented source references', () => {
    const pack = structuredClone(rulePack);
    pack.requirements[0].sources = ['invented'];
    expect(() => validateRulePack(pack)).toThrow();
  });
  it('rejects duplicate requirement identifiers', () => {
    const pack = structuredClone(rulePack);
    pack.requirements[1].id = pack.requirements[0].id;
    expect(() => validateRulePack(pack)).toThrow();
  });
});
