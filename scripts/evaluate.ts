import { mkdir, writeFile } from 'node:fs/promises';
import { runScenarios } from '../src/lib/scenarios';
const result = runScenarios();
await mkdir('evaluation', { recursive: true });
await writeFile('evaluation/results.json', JSON.stringify(result, null, 2) + '\n');
console.log(
  `${result.passed}/${result.total} authored scenarios matched expected labels. Independent human review and model-based comparison are not completed.`,
);
if (result.passed !== result.total) process.exitCode = 1;
