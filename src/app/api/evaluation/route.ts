import { runScenarios } from '@/lib/scenarios';
import baseline from '../../../../evaluation/baseline.json';
import multiEvent from '../../../../evaluation/multi-event-context.json';

export function GET() {
  return Response.json({
    ...runScenarios(),
    baseline: {
      runAt: baseline.runAt,
      model: baseline.model,
      total: baseline.total,
      completed: baseline.completed,
      passed: baseline.passed,
      mismatches: baseline.results
        .filter((result) => !result.passed)
        .map(({ name, status, expected }) => ({ name, status, expected })),
    },
    multiEvent: {
      runAt: multiEvent.runAt,
      limitations: multiEvent.limitations,
      results: multiEvent.results.map(
        ({
          eventId,
          ruleId,
          expected,
          actual,
          agentInterpretation,
          citedRelevantRule,
          elapsedMs,
        }) => ({
          eventId,
          ruleId,
          expected,
          actual,
          agentInterpretation,
          citedRelevantRule,
          elapsedMs,
        }),
      ),
    },
  });
}
