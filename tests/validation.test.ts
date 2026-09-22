import { describe, expect, it } from 'vitest';
import { dossierSchema, reportSchema, savedCaseSchema } from '../src/lib/model';
import { checkDossier } from '../src/lib/engine';
import { examples, rulePack } from '../src/lib/rules';
import { validateRulePack } from '../src/lib/sanity';
import { readArgsSchema } from '../src/lib/source-agent';

describe('input and saved report boundaries', () => {
  it.each(['2026-02-30', '2026-09-18T16:00:00', '2026-09-31', '2026-09-18T99:00:00Z'])(
    'rejects ambiguous or invalid date %s',
    (startedAt) => {
      expect(dossierSchema.safeParse({ ...examples[0].dossier, startedAt }).success).toBe(false);
    },
  );
  it.each(['2026-09-18', '2026-09-18T16:00:00Z', '2026-09-18T21:30:00+05:30'])(
    'accepts valid dates with explicit precision %s',
    (startedAt) => {
      expect(dossierSchema.safeParse({ ...examples[0].dossier, startedAt }).success).toBe(true);
    },
  );
  it('rejects malformed stored reports', () => {
    expect(
      savedCaseSchema.safeParse({ id: 'x', dossier: examples[0].dossier, report: { findings: [] } })
        .success,
    ).toBe(false);
    expect(reportSchema.safeParse(checkDossier(examples[0].dossier, rulePack)).success).toBe(true);
  });
  it('rejects a rule with an unknown fact rather than implying a pass', () => {
    const pack = structuredClone(rulePack);
    pack.requirements[0].check = { op: 'neq', fact: 'invented', value: false };
    expect(() => validateRulePack(pack)).toThrow();
  });
  it('bounds agent reads and rejects arbitrary tool arguments', () => {
    expect(
      readArgsSchema.safeParse({ knowledgeBase: 'kb123', paths: ['rules/general'] }).success,
    ).toBe(true);
    expect(
      readArgsSchema.safeParse({ knowledgeBase: 'kb123', paths: Array(21).fill('rules/general') })
        .success,
    ).toBe(false);
    expect(
      readArgsSchema.safeParse({ knowledgeBase: 'kb123', paths: ['rules'], write: true }).success,
    ).toBe(false);
  });
});
