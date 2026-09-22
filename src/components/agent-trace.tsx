import { Check, CircleAlert } from 'lucide-react';
import type { TraceStep } from '@/lib/agent-trace';

export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  return (
    <details className="run-trace">
      <summary>View {steps.length} actual steps</summary>
      <ol>
        {[...steps]
          .sort((a, b) => a.startedMs - b.startedMs)
          .map((step, index) => (
            <li key={`${step.kind}-${step.startedMs}-${index}`}>
              {step.ok ? (
                <Check size={15} aria-label="Completed" />
              ) : (
                <CircleAlert size={15} aria-label="Failed" />
              )}
              <div>
                <strong>{step.kind === 'model' ? `Model round ${step.round}` : step.tool}</strong>
                {step.kind === 'mcp' && Array.isArray(step.arguments.paths) && (
                  <code>{step.arguments.paths.join(', ')}</code>
                )}
                {step.detail && <span>{step.detail}</span>}
              </div>
              <time>{(step.durationMs / 1000).toFixed(1)}s</time>
            </li>
          ))}
      </ol>
    </details>
  );
}
