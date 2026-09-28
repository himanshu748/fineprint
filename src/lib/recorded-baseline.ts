import baseline from '../../evaluation/baseline.json';

export const recordedBaseline = {
  runAt: baseline.runAt,
  model: baseline.model,
  packVersion: baseline.packVersion,
  total: baseline.total,
  completed: baseline.completed,
  passed: baseline.passed,
  mismatches: baseline.results
    .filter((result) => !result.passed)
    .map(({ name, status, expected }) => ({ name, status, expected })),
};
