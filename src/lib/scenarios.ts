import type { Dossier, Status } from './model';
import { checkDossier } from './engine';
import { examples, rulePack } from './rules';

export const evaluationClock = '2026-09-20T12:00:00.000Z';
export type Scenario = {
  name: string;
  patch: Partial<Dossier>;
  rule: string;
  expected: Status;
  clock?: string;
};
export const scenarios: Scenario[] = [
  {
    name: 'A new entry can reuse components',
    patch: { origin: 'components' },
    rule: 'origin',
    expected: 'supported',
  },
  {
    name: 'An old application remains an old entry',
    patch: { origin: 'existing' },
    rule: 'origin',
    expected: 'blocked',
  },
  {
    name: 'Missing project history stays unknown',
    patch: { origin: null },
    rule: 'origin',
    expected: 'missing',
  },
  {
    name: 'A start before the event is blocked',
    patch: { startedAt: '2026-09-17' },
    rule: 'start',
    expected: 'blocked',
  },
  {
    name: 'Opening-day date needs an exact time',
    patch: { startedAt: '2026-09-18' },
    rule: 'start',
    expected: 'missing',
  },
  {
    name: 'One second before opening is too early',
    patch: { startedAt: '2026-09-18T15:59:59Z' },
    rule: 'start',
    expected: 'blocked',
  },
  {
    name: 'The exact opening timestamp is allowed',
    patch: { startedAt: '2026-09-18T16:00:00Z' },
    rule: 'start',
    expected: 'supported',
  },
  {
    name: 'Starting after the event is blocked',
    patch: { startedAt: '2026-10-06' },
    rule: 'start',
    expected: 'blocked',
  },
  {
    name: 'A missing start date is not inferred',
    patch: { startedAt: null },
    rule: 'start',
    expected: 'missing',
  },
  {
    name: 'Four team members meet the limit',
    patch: { teamSize: 4 },
    rule: 'team',
    expected: 'supported',
  },
  {
    name: 'Five team members exceed the limit',
    patch: { teamSize: 5 },
    rule: 'team',
    expected: 'blocked',
  },
  {
    name: 'An unknown team size is not a solo team',
    patch: { teamSize: null },
    rule: 'team',
    expected: 'missing',
  },
  {
    name: 'One age-ineligible member blocks the team',
    patch: { adultTeam: false },
    rule: 'age',
    expected: 'blocked',
  },
  {
    name: 'Missing age confirmation stays unknown',
    patch: { adultTeam: null },
    rule: 'age',
    expected: 'missing',
  },
  {
    name: 'Residency is never guessed from a name',
    patch: { eligibleResidency: null },
    rule: 'residency',
    expected: 'missing',
  },
  {
    name: 'An excluded affiliation blocks entry',
    patch: { excludedAffiliation: true },
    rule: 'affiliation',
    expected: 'blocked',
  },
  {
    name: 'Reused material needs attribution',
    patch: { origin: 'components', priorWorkCredited: false },
    rule: 'credit',
    expected: 'blocked',
  },
  {
    name: 'No reused material makes credit inapplicable',
    patch: { origin: 'new', priorWorkCredited: null },
    rule: 'credit',
    expected: 'not-applicable',
  },
  {
    name: 'Unknown reuse makes applicability unknown',
    patch: { origin: null, priorWorkCredited: true },
    rule: 'credit',
    expected: 'missing',
  },
  {
    name: 'Insignificant changes fail the stated condition',
    patch: { substantialNewWork: false },
    rule: 'new-work',
    expected: 'blocked',
  },
  {
    name: 'Path One needs a Knowledge Base',
    patch: { usesKnowledgeBase: false },
    rule: 'context',
    expected: 'blocked',
  },
  {
    name: 'A missing Context connection stays unknown',
    patch: { usesContext: null },
    rule: 'context',
    expected: 'missing',
  },
  {
    name: 'A known failure remains a failure with another unknown',
    patch: { usesContext: false, usesKnowledgeBase: null },
    rule: 'context',
    expected: 'blocked',
  },
  {
    name: 'Path Two does not inherit Path One requirements',
    patch: { track: 'path-two', usesContext: false },
    rule: 'context',
    expected: 'not-applicable',
  },
  {
    name: 'Path Two checks its own technology requirements',
    patch: { track: 'path-two', aiBuilt: true, supportedFrontend: true, usesSanity: true },
    rule: 'path-two',
    expected: 'supported',
  },
  {
    name: 'Both paths activate both sets of requirements',
    patch: { track: 'both', aiBuilt: false, supportedFrontend: true, usesSanity: true },
    rule: 'path-two',
    expected: 'blocked',
  },
  {
    name: 'One entry satisfies both conflicting statements',
    patch: { entriesPerPath: 1 },
    rule: 'entry-limit',
    expected: 'supported',
  },
  {
    name: 'Two same-path entries activate the discrepancy',
    patch: { entriesPerPath: 2 },
    rule: 'entry-limit',
    expected: 'unclear',
  },
  {
    name: 'An unknown entry count stays unknown',
    patch: { entriesPerPath: null },
    rule: 'entry-limit',
    expected: 'missing',
  },
  {
    name: 'Non-English affects prize eligibility',
    patch: { englishSubmission: false },
    rule: 'english',
    expected: 'blocked',
  },
  {
    name: 'A tie-break rule does not authorize both prizes',
    patch: { seeksMultiplePrizes: true },
    rule: 'combination',
    expected: 'unclear',
  },
  {
    name: 'One prize makes combination checking inapplicable',
    patch: { seeksMultiplePrizes: false },
    rule: 'combination',
    expected: 'not-applicable',
  },
  {
    name: 'A login-free app does not need credentials',
    patch: { requiresLogin: false, judgeAccess: null },
    rule: 'access',
    expected: 'not-applicable',
  },
  {
    name: 'Unknown login requirements remain unknown',
    patch: { requiresLogin: null, judgeAccess: true },
    rule: 'access',
    expected: 'missing',
  },
  {
    name: 'Login without judge access blocks readiness',
    patch: { requiresLogin: true, judgeAccess: false },
    rule: 'access',
    expected: 'blocked',
  },
  {
    name: 'An absent project identifier needs a fact',
    patch: { projectIdentifier: null },
    rule: 'identifier',
    expected: 'missing',
  },
  {
    name: 'An explicitly empty identifier is missing an artifact',
    patch: { projectIdentifier: '' },
    rule: 'identifier',
    expected: 'blocked',
  },
  {
    name: 'A draft is not a published submission',
    patch: { publishedPost: false, hasChallengeTag: true },
    rule: 'post',
    expected: 'blocked',
  },
  {
    name: 'Both paths require separate posts',
    patch: { track: 'both', separatePosts: false },
    rule: 'separate-posts',
    expected: 'blocked',
  },
  {
    name: 'The exact deadline is included',
    patch: {},
    rule: 'deadline',
    expected: 'supported',
    clock: '2026-10-05T06:59:00.000Z',
  },
  {
    name: 'The window closes after the recorded deadline',
    patch: {},
    rule: 'deadline',
    expected: 'blocked',
    clock: '2026-10-05T06:59:01.000Z',
  },
  {
    name: 'Checking before opening does not imply submissions are open',
    patch: {},
    rule: 'deadline',
    expected: 'blocked',
    clock: '2026-09-18T15:59:59.000Z',
  },
];
export function runScenarios() {
  const cases = scenarios.map((scenario) => {
    const report = checkDossier(
      { ...examples[0].dossier, ...scenario.patch },
      rulePack,
      scenario.clock ?? evaluationClock,
    );
    const actual = report.findings.find((f) => f.rule.id === scenario.rule)!.status;
    return {
      name: scenario.name,
      rule: scenario.rule,
      expected: scenario.expected,
      actual,
      passed: actual === scenario.expected,
    };
  });
  return {
    total: cases.length,
    passed: cases.filter((c) => c.passed).length,
    clock: evaluationClock,
    rulePackVersion: rulePack.version,
    labelReview: 'Developer-authored; independent human review pending',
    baseline: 'Not run',
    cases,
  };
}
