'use client';
import { useState } from 'react';
import { StatusTag } from '../status-tag';
import { AgentTrace } from '../agent-trace';
import { statusSchema } from '@/lib/model';
import { traceStepSchema } from '@/lib/agent-trace';

type RecordedResult = {
  eventId: string;
  packVersion: string;
  actual: string;
  agentInterpretation: string;
  elapsedMs: number;
  trace: unknown[];
  sourceRecords: { path: string; records: { kind: string; id: string; title: string }[] }[];
};
export function RecordedComparison({ results }: { results: RecordedResult[] }) {
  const [example, setExample] = useState(0);
  return (
    <div className="recorded-comparison">
      <div className="recorded-switch" role="group" aria-label="Recorded comparison">
        {['Team size', 'Development date'].map((label, index) => (
          <button key={label} aria-pressed={example === index} onClick={() => setExample(index)}>
            {label}
          </button>
        ))}
      </div>
      <p className="recorded-fact">
        {example === 0 ? 'Five people on the team.' : 'Development began August 23, 2026.'}
      </p>
      <div aria-live="polite">
        {results.slice(example * 2, example * 2 + 2).map((result) => (
          <article className="recorded-event" key={result.eventId}>
            <header>
              <strong>
                {result.eventId === 'sanity-2026'
                  ? 'Sanity · Path One'
                  : 'GIBC V2 · Open Invention'}
              </strong>
              <StatusTag status={statusSchema.parse(result.actual)} />
            </header>
            <p>Rule check · source pack {result.packVersion}</p>
            {result.actual !== result.agentInterpretation && (
              <p className="recorded-disagreement">
                The model said “Rules unclear”. It asked for a timezone unnecessarily; the rule
                checker accepts this date. Both results are preserved.
              </p>
            )}
            <details>
              <summary>Inspect source reads · {(result.elapsedMs / 1000).toFixed(1)}s</summary>
              <p>Sanity Context entries retrieved in this run, linked to structured records:</p>
              {result.sourceRecords.map((source) => (
                <div className="recorded-source" key={source.path}>
                  <code>{source.path}</code>
                  <ul>
                    {source.records.map((record) => (
                      <li key={`${record.kind}-${record.id}`}>
                        {record.title} <small>{record.kind}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <AgentTrace steps={result.trace.map((step) => traceStepSchema.parse(step))} />
            </details>
          </article>
        ))}
      </div>
      <p className="recorded-caption">
        Recorded September 22, 2026 · no live request. Four authored questions, not an accuracy
        benchmark. These selected checks do not establish overall eligibility.
      </p>
    </div>
  );
}
