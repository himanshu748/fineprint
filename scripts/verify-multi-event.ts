import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { askWithSources, questionDossier } from '../src/lib/question-agent';
import { loadRulePack } from '../src/lib/sanity';
import { checkDossier } from '../src/lib/engine';
import { ruleImpact } from '../src/lib/rule-impact';
import type { Dossier, EventId, Status } from '../src/lib/model';

const cases: {
  eventId: EventId;
  track: Dossier['track'];
  question: string;
  ruleId: string;
  expected: Status;
}[] = [
  {
    eventId: 'sanity-2026',
    track: 'path-one',
    question:
      'We have five people on our team. Does the team-size rule allow us to enter Path One?',
    ruleId: 'team',
    expected: 'blocked',
  },
  {
    eventId: 'gibc-v2-2026',
    track: 'open-invention',
    question:
      'We have five people on our team. Does the team-size rule allow us to enter Open Invention?',
    ruleId: 'gibc-team',
    expected: 'supported',
  },
  {
    eventId: 'sanity-2026',
    track: 'path-one',
    question:
      'We began development on August 23, 2026. Does that meet the development-start requirement for Path One?',
    ruleId: 'start',
    expected: 'blocked',
  },
  {
    eventId: 'gibc-v2-2026',
    track: 'open-invention',
    question:
      'We began development on August 23, 2026. Does that meet the development-start requirement for Open Invention?',
    ruleId: 'gibc-start',
    expected: 'supported',
  },
];
const results = [];
for (const item of cases) {
  const { pack, mode } = await loadRulePack(item.eventId);
  assert.equal(mode, 'sanity');
  const result = await askWithSources(item.question, questionDossier(item.track), pack, mode);
  const finding = result.report.findings.find((finding) => finding.rule.id === item.ruleId)!;
  const comparison = result.comparison.find((comparison) => comparison.ruleId === item.ruleId);
  const record = {
    eventId: item.eventId,
    packVersion: pack.version,
    question: item.question,
    ruleId: item.ruleId,
    expected: item.expected,
    actual: finding.status,
    engineMatchesAuthoredLabel: finding.status === item.expected,
    agentInterpretation: comparison?.agent ?? null,
    citedRelevantRule: Boolean(comparison),
    elapsedMs: result.elapsedMs,
    answer: result.answer,
    citations: result.citations,
    acceptedFacts: result.facts.filter((fact) => fact.status === 'stated'),
    sourceRecords: result.knowledgeBase.read,
    trace: result.trace,
  };
  results.push(record);
  await writeFile(
    'evaluation/multi-event-context.json',
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        model: process.env.MODAL_MODEL,
        provider: 'Modal',
        method:
          'Four authored paired questions, using the live event packs, the same model and the same agent. Expected labels are withheld from the agent. Actual Context reads and the typed check are recorded.',
        limitations:
          'A small integration regression, not independent accuracy, a competitor comparison or a keyword-search ablation. Failed runs and disagreements must not be discarded.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      eventId: item.eventId,
      ruleId: item.ruleId,
      status: finding.status,
      expected: item.expected,
      grounded: Boolean(comparison),
      elapsedMs: result.elapsedMs,
    }),
  );
}
// Exercise change propagation without publishing fictional rule updates.
const { pack } = await loadRulePack('gibc-v2-2026');
const before = checkDossier({ ...questionDossier('open-invention'), teamSize: 5 }, pack);
const hypothetical = structuredClone(pack);
hypothetical.version += '-rehearsal';
hypothetical.requirements.find((rule) => rule.id === 'gibc-team')!.check = {
  op: 'lte',
  fact: 'teamSize',
  value: 3,
};
const impact = ruleImpact(before, hypothetical)!;
assert.deepEqual(
  impact.changes.map((change) => change.id),
  ['gibc-team'],
);
await writeFile(
  'evidence/multi-event-impact.json',
  JSON.stringify(
    {
      hypothetical: true,
      published: false,
      eventId: pack.id,
      baseVersion: pack.version,
      impact,
      before: before.findings.find((finding) => finding.rule.id === 'gibc-team')!.status,
      after: checkDossier(before.dossier, hypothetical).findings.find(
        (finding) => finding.rule.id === 'gibc-team',
      )!.status,
    },
    null,
    2,
  ) + '\n',
);
assert(results.every((result) => result.engineMatchesAuthoredLabel && result.citedRelevantRule));
