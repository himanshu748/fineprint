import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { assessRepository } from '../src/lib/repository-assessment';
const report = await assessRepository(
  'https://github.com/himanshu748/fineprint',
  'sanity-path-one',
);
assert.equal(report.findings.length, 4);
assert(report.findings.some((f) => f.evidence.length > 0));
assert(report.contextPaths.length > 0);
await writeFile('evidence/repository-review.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    commit: report.commit,
    files: report.coverage.inspected.length,
    context: report.contextPaths,
    elapsedMs: report.elapsedMs,
    findings: report.findings.map((f) => ({
      id: f.criterionId,
      status: f.status,
      evidence: f.evidence.length,
      discarded: f.discardedEvidence,
    })),
  }),
);
