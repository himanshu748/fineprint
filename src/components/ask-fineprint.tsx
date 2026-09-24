'use client';
import { StatusTag } from './status-tag';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, CircleAlert, LoaderCircle, MessageSquareText } from 'lucide-react';
import {
  askResponseSchema,
  agentErrorSchema,
  type AskResponse,
  type AgentError,
} from '@/lib/agent-schema';
import { describeEvent } from '@/lib/events';
import type { ImportedEvent } from '@/lib/imported-event';
import type { Dossier } from '@/lib/model';
import { formatFact } from '@/lib/engine';
import { AgentTrace } from './agent-trace';
import { AgentAccessForm } from './agent-access-form';

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
  imported = null,
  onApply,
  initialQuestion = '',
  initialResult = null,
  onRemember,
  onManualReview,
  onSources,
}: {
  dossier: Dossier;
  imported?: ImportedEvent | null;
  onApply: (answer: AskResponse) => void;
  initialQuestion?: string;
  initialResult?: AskResponse | null;
  onRemember: (question: string, answer: AskResponse | null) => void;
  onManualReview: () => void;
  onSources: () => void;
}) {
  const event = describeEvent(dossier.eventId, imported ? [imported] : []);
  const eventPrompts = imported
    ? [
        {
          label: 'Team and timing',
          text: 'We are a team of three and started building last month. Which of these rules could stop us?',
        },
        {
          label: 'What to submit',
          text: 'What do we need to submit, and which rules should we check ourselves?',
        },
      ]
    : dossier.eventId === 'sanity-2026'
      ? prompts
      : [
          {
            label: 'A five-person team',
            text: 'We are a team of five students. Can we enter Open Invention?',
          },
          {
            label: 'An August start',
            text: 'We began development on August 23, 2026. Does that fit the Open Invention build window?',
          },
        ];
  const [question, setQuestion] = useState(initialQuestion);
  const [track, setTrack] = useState<Dossier['track']>(dossier.track);
  const [includeFacts, setIncludeFacts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(initialResult);
  const [error, setError] = useState<AgentError | null>(null);
  const [unlock, setUnlock] = useState(false);
  const [applied, setApplied] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);
  const remember = useRef(onRemember);
  remember.current = onRemember;
  useEffect(() => {
    remember.current(question, result);
  }, [question, result]);
  useEffect(() => {
    setTrack(dossier.track);
  }, [dossier.track]);

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
        body: JSON.stringify({
          question,
          track,
          eventId: dossier.eventId,
          ...(includeFacts ? { dossier } : {}),
          ...(imported ? { imported } : {}),
        }),
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
      // Preserve a completed answer even if its panel was closed while it ran.
      remember.current(question, parsed.data);
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
          <p>
            {imported
              ? `The agent reads FinePrint’s Knowledge Base for how to weigh rules, and the rules imported from ${imported.host}. Those rules are not reviewed and not in the Knowledge Base.`
              : 'Describe the part you’re unsure about. Follow the answer back to its sources.'}
          </p>
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
            placeholder="Describe your project and the rule you’re unsure about."
          />
        </label>
        <div className="ask-examples">
          <span>Try asking about</span>
          {eventPrompts.map((prompt) => (
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
              {event.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </select>
          </label>
          <label className="ask-include">
            <input
              type="checkbox"
              checked={includeFacts}
              disabled={busy}
              onChange={(event) => setIncludeFacts(event.target.checked)}
            />
            Include my current project facts
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
          Your question{includeFacts ? ' and selected project facts are' : ' is'} sent to Modal. A
          copy of your question and answer is saved in this browser. AI requests share an allowance
          of five runs per ten minutes. The form works without AI.
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
          <button className="secondary-button" onClick={onManualReview}>
            Continue with the form <ArrowRight size={15} />
          </button>
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
            <span>Sources read</span>
            {result.citations.map((path) => (
              <span className="source-topic" key={path} title={path}>
                {path.replaceAll('_', ' ').replaceAll('/', ' / ')}
              </span>
            ))}
            <button className="text-button" onClick={onSources}>
              Read the official rules <ArrowRight size={14} />
            </button>
          </div>
          <div className="ask-comparisons">
            <h4>Checks behind this answer</h4>
            <p>
              Your stated facts are checked against the rules. Different interpretations stay
              visible.
            </p>
            {result.comparison.map((item) => (
              <div className="ask-comparison" key={item.ruleId}>
                <strong>{item.title}</strong>
                <span>
                  Source reading <StatusTag status={item.agent} />
                </span>
                <span>
                  Rule check <StatusTag status={item.engine} />
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
          {result.imported && (
            <details className="ask-facts">
              <summary>
                {result.imported.read.length} imported rules read from {result.imported.host}, not
                in the Knowledge Base
              </summary>
              <dl>
                {result.imported.read.map((row) => (
                  <div key={row.id}>
                    <dt>
                      {row.title} <code>imported:{row.id}</code>
                    </dt>
                    <dd>
                      <q>{row.quote}</q>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <AgentTrace steps={result.trace} />
          <div className="ask-apply">
            <p>
              {result.engine.checked} requirements checked · {result.engine.counts.missing} need
              facts.
              <br />
              <small>
                Add the quoted facts to your review and check again. Your other answers and notes
                stay as entered.
              </small>
            </p>
            <button
              className="secondary-button"
              disabled={applied}
              onClick={() => {
                onApply(result);
                setApplied(true);
              }}
            >
              {applied ? 'Facts added to your review' : 'Add these facts to my review'}
              <ArrowDown size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
