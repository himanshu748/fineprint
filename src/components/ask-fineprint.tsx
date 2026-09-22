'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, CircleAlert, LoaderCircle, MessageSquareText } from 'lucide-react';
import {
  askResponseSchema,
  agentErrorSchema,
  type AskResponse,
  type AgentError,
} from '@/lib/agent-schema';
import type { Dossier, Report, Status } from '@/lib/model';
import { formatFact } from '@/lib/engine';
import { AgentTrace } from './agent-trace';
import { AgentAccessForm } from './agent-access-form';

const labels: Record<Status, string> = {
  supported: 'Supported',
  blocked: 'Blocked',
  missing: 'Missing fact',
  unclear: 'Rules unclear',
  'not-applicable': 'Not applicable',
};
const prompts = [
  {
    label: 'An earlier project',
    text: 'I started my app in August. I added Sanity this week. Can I enter Path One?',
  },
  {
    label: 'Two entries, one path',
    text: 'I am planning two entries in Path One. Which submission limit applies?',
  },
];

export function AskFinePrint({
  dossier,
  onApply,
}: {
  dossier: Dossier;
  onApply: (report: Report) => void;
}) {
  const [question, setQuestion] = useState('');
  const [track, setTrack] = useState<Dossier['track']>('path-one');
  const [includeFacts, setIncludeFacts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const [unlock, setUnlock] = useState(false);
  const [applied, setApplied] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, track, ...(includeFacts ? { dossier } : {}) }),
        signal: AbortSignal.timeout(290_000),
      });
      const raw: unknown = await response.json();
      if (!response.ok) {
        const parsed = agentErrorSchema.safeParse(raw);
        const failure = parsed.success
          ? parsed.data
          : { error: 'The request did not finish. Try again.' };
        if (failure.code === 'ACCESS_REQUIRED') setUnlock(true);
        setError(failure);
        return;
      }
      const parsed = askResponseSchema.safeParse(raw);
      if (!parsed.success)
        throw new Error(
          'The response could not be validated. Your existing report has not changed.',
        );
      setResult(parsed.data);
      requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: true }));
    } catch (failure) {
      setError({
        error:
          failure instanceof Error && failure.name === 'TimeoutError'
            ? 'The live run took too long. Try again later; the manual review desk is available below.'
            : 'The live run could not be completed. Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ask-panel" aria-labelledby="ask-title">
      <div className="ask-intro">
        <MessageSquareText size={23} strokeWidth={1.6} />
        <div>
          <h2 id="ask-title">Ask FinePrint</h2>
          <p>Describe the part you’re unsure about. Follow the answer back to its sources.</p>
        </div>
      </div>
      <form onSubmit={(event) => void ask(event)}>
        <label className="ask-question">
          <span>Your project or rule question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={10}
            maxLength={1800}
            required
            rows={3}
            disabled={busy}
            placeholder="I started my app before the event, but added Sanity this week. Can I enter?"
          />
        </label>
        <div className="ask-examples">
          <span>Try asking about</span>
          {prompts.map((prompt) => (
            <button
              type="button"
              key={prompt.label}
              disabled={busy}
              onClick={() => setQuestion(prompt.text)}
            >
              {prompt.label}
              <ArrowRight size={13} />
            </button>
          ))}
        </div>
        <div className="ask-actions">
          <label className="ask-path">
            <span>Review path</span>
            <select
              value={track}
              disabled={busy}
              onChange={(event) => setTrack(event.target.value as Dossier['track'])}
            >
              <option value="path-one">Path One · agent</option>
              <option value="path-two">Path Two · app</option>
              <option value="both">Both paths</option>
            </select>
          </label>
          <label className="ask-include">
            <input
              type="checkbox"
              checked={includeFacts}
              disabled={busy}
              onChange={(event) => setIncludeFacts(event.target.checked)}
            />
            Also use the facts in my review desk
          </label>
          <button
            className="primary-button ask-submit"
            type="submit"
            disabled={busy || question.trim().length < 10}
          >
            {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}
            {busy ? 'Reading and checking…' : 'Ask FinePrint'}
          </button>
        </div>
        <p className="ask-privacy">
          Your question{includeFacts ? ' and selected project facts are' : ' is'} sent to Modal.
          Sanity supplies the rule sources. Saved reports stay in this browser. Public demo: five
          shared runs per ten minutes.
        </p>
      </form>
      {busy && (
        <div className="ask-working" role="status">
          <LoaderCircle size={17} className="spin" />
          <p>
            Reading the Knowledge Base, checking stated facts and preparing a cited answer. The
            actual steps will appear when the run finishes.
          </p>
        </div>
      )}
      {unlock && (
        <AgentAccessForm
          onAuthorized={() => {
            setUnlock(false);
            setError(null);
          }}
          onCancel={() => setUnlock(false)}
        />
      )}
      {error && (
        <div className="ask-error" role="alert">
          <p>
            <CircleAlert size={18} />
            {error.error}
          </p>
          {error.trace && <AgentTrace steps={error.trace} />}
        </div>
      )}
      {result && (
        <div className="ask-answer" ref={answerRef} tabIndex={-1}>
          <div className="ask-answer-heading">
            <h3>What the sources say</h3>
            <span>Live run · {(result.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          <p className="answered-question">For: {result.question}</p>
          <p className="answer-prose">{result.answer}</p>
          <div className="ask-citations">
            <span>Read from Sanity</span>
            {result.citations.map((path) => (
              <code key={path}>{path}</code>
            ))}
          </div>
          <div className="ask-comparisons">
            <h4>Source interpretation and typed checks</h4>
            <p>Agreement is a comparison, not independent verification.</p>
            {result.comparison.map((item) => (
              <div className="ask-comparison" key={item.ruleId}>
                <strong>{item.title}</strong>
                <span>
                  Agent <b className={`status-tag ${item.agent}`}>{labels[item.agent]}</b>
                </span>
                <span>
                  Rule check <b className={`status-tag ${item.engine}`}>{labels[item.engine]}</b>
                </span>
                {!item.agrees && (
                  <em>
                    Different interpretations. Review the source before relying on this finding.
                  </em>
                )}
              </div>
            ))}
          </div>
          <details className="ask-facts">
            <summary>
              {result.facts.filter((fact) => fact.status === 'stated').length} facts extracted from
              your words
            </summary>
            <p>
              Review these readings. Facts not stated in your question are only used if you chose to
              include the review desk.
            </p>
            <dl>
              {result.facts
                .filter((fact) => fact.status === 'stated')
                .map((fact) => (
                  <div key={fact.key}>
                    <dt>{fact.label}</dt>
                    <dd>
                      {formatFact(fact.value)}
                      {fact.status === 'stated' && (
                        <>
                          <q>{fact.quote}</q>
                          {fact.note && <small>{fact.note}</small>}
                        </>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
            {result.rejectedFacts.length > 0 && (
              <p>
                {result.rejectedFacts.length} proposed facts were rejected. Supply them manually if
                needed.
              </p>
            )}
          </details>
          {result.citationsRemoved.length > 0 && (
            <p className="ask-validation-note">
              Unretrieved citations were removed from the model’s citation list. Review the answer
              against the listed entries.
            </p>
          )}
          <AgentTrace steps={result.trace} />
          <div className="ask-apply">
            <p>
              {result.engine.checked} requirements checked · {result.engine.counts.missing} need
              facts.
              <br />
              <small>
                Applying replaces the desk with this question’s facts and keeps the current report
                for comparison.
              </small>
            </p>
            <button
              className="secondary-button"
              disabled={applied}
              onClick={() => {
                onApply(result.report);
                setApplied(true);
              }}
            >
              {applied ? 'Applied to review desk' : 'Review these facts below'}
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
