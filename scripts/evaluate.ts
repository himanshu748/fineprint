import { mkdir, writeFile } from 'node:fs/promises';
import { recordedBaseline } from '../src/lib/recorded-baseline';
import { runScenarios } from '../src/lib/scenarios';
const current = runScenarios();
const result = {
  ...current,
  baseline: recordedBaseline,
  comparison: {
    directlyComparable: false,
    currentRulePackVersion: current.rulePackVersion,
    historicalRulePackVersion: recordedBaseline.packVersion,
    note: 'Current authored regression and historical model run use different rule-pack versions. The two-entry case changed from unclear to blocked. These totals are not a head-to-head comparison or independent accuracy measurement.',
  },
};
await mkdir('evaluation', { recursive: true });
await writeFile('evaluation/results.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  `${result.passed}/${result.total} authored scenarios matched current labels on pack ${current.rulePackVersion}. Historical model baseline: ${recordedBaseline.passed}/${recordedBaseline.total} on pack ${recordedBaseline.packVersion}. Different rule versions: not a head-to-head comparison. Independent human review is not completed.`,
);
if (result.passed !== result.total) process.exitCode = 1;
