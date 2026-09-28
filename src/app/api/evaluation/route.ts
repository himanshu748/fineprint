import { runScenarios } from '@/lib/scenarios';
import { recordedBaseline } from '@/lib/recorded-baseline';
import multiEvent from '../../../../evaluation/multi-event-context.json';

export function GET() {
  return Response.json({
    ...runScenarios(),
    baseline: recordedBaseline,
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
