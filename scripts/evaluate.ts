import { mkdir, writeFile } from 'node:fs/promises';
import { recordedBaseline } from '../src/lib/recorded-baseline';
import { runScenarios } from '../src/lib/scenarios';
const result = { ...runScenarios(), baseline: recordedBaseline };
await mkdir('evaluation', { recursive: true });
await writeFile('evaluation/results.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  `${result.passed}/${result.total} authored scenarios matched expected labels. Recorded model baseline: ${recordedBaseline.passed}/${recordedBaseline.total} on pack ${recordedBaseline.packVersion}. Independent human review is not completed.`,
);
if (result.passed !== result.total) process.exitCode = 1;
