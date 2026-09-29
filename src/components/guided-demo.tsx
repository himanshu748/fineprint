'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, FileSearch } from 'lucide-react';
import { checkDossier } from '@/lib/engine';
import { traceStepSchema } from '@/lib/agent-trace';
import { examples, rulePack, rulePackSeptember20 } from '@/lib/rules';
import { ruleImpact } from '@/lib/rule-impact';
import { statusSchema } from '@/lib/model';
import recorded from '../../evaluation/multi-event-context.json';
import { StatusTag } from './status-tag';
import { AgentTrace } from './agent-trace';
import { AskFinePrint } from './ask-fineprint';
import { KnowledgeBaseReads } from './knowledge-base-reads';
import styles from './guided-demo.module.css';

const steps = ['Read the rule', 'Check the facts', 'Apply the update'];
const checkedAt = '2026-09-24T12:00:00.000Z';
const sample = examples[2].dossier;
const savedReport = checkDossier(sample, rulePackSeptember20, checkedAt);
const savedFinding = savedReport.findings.find((finding) => finding.rule.id === 'entry-limit')!;
const impact = ruleImpact(savedReport, rulePack)!;
const entryChange = impact.changes.find((change) => change.id === 'entry-limit')!;
const receipt = recorded.results.find(
  (result) => result.eventId === 'sanity-2026' && result.ruleId === 'team',
)!;
const teamRule = rulePack.requirements.find((rule) => rule.id === 'team')!;
const teamRead = receipt.sourceRecords.find((entry) =>
  entry.records.some((record) => record.kind === 'requirement' && record.id === 'team'),
)!;
const quotedTeamFact = receipt.acceptedFacts.find((fact) => fact.key === 'teamSize')!;

export function GuidedDemo() {
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState(2);
  const [liveOpen, setLiveOpen] = useState(false);
  const currentReport = checkDossier({ ...sample, entriesPerPath: entries }, rulePack, checkedAt);
  const currentFinding = currentReport.findings.find(
    (finding) => finding.rule.id === 'entry-limit',
  )!;
  const oldContest = rulePackSeptember20.sources.find((source) => source.id === 'contest')!;
  const newContest = rulePack.sources.find((source) => source.id === 'contest')!;
  const oldFaq = rulePackSeptember20.sources.find((source) => source.id === 'faq')!;
  const finding = step < 2 ? savedFinding : currentFinding;

  return (
    <div className={styles.page}>
      <a className="skip-link" href="#demo-main">
        Skip to guided demo
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="FinePrint home">
          <FileSearch size={25} strokeWidth={1.65} /> FinePrint.
        </Link>
        <nav aria-label="Demo navigation">
          <Link href="/review">
            Start my review <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="demo-main" className={styles.main}>
        <div className={styles.intro}>
          <h1>See the rule behind the answer.</h1>
          <p>
            A builder plans two entries in the same path. Follow the official wording, check the
            sample facts, then see what changes when the rules change.
          </p>
          <span>Illustrative project · real dated sources · checks run without AI</span>
        </div>

        <nav className={styles.steps} aria-label="Guided demo steps">
          {steps.map((label, index) => (
            <button
              key={label}
              aria-current={step === index ? 'step' : undefined}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        <section className={styles.workbench} aria-labelledby="demo-step-title">
          <div className={styles.explanation}>
            <h2 id="demo-step-title">
              {step === 0
                ? 'Two sources. Two different limits.'
                : step === 1
                  ? 'A conflict stays a conflict.'
                  : entries === 2
                    ? 'The revised rule blocks the second entry.'
                    : 'One entry satisfies this rule.'}
            </h2>
            <p>
              {step === 0
                ? 'On September 20, the FAQ limited submissions to one per path. The contest rules allowed unlimited entries. FinePrint kept both sources and recorded the disagreement.'
                : step === 1
                  ? 'The sample declares two entries in Path One. The checker finds the conflicting wording and returns “Rules unclear”. The agent cannot turn that into permission to submit.'
                  : 'On September 24, the contest rules changed to the same one-per-path limit as the FAQ. Rechecking the same facts changes this finding. Try reducing the number of entries.'}
            </p>
            <dl className={styles.facts}>
              <div>
                <dt>Submission path</dt>
                <dd>Path One</dd>
              </div>
              <div>
                <dt>Entries in this path</dt>
                <dd>{step < 2 ? 2 : entries}</dd>
              </div>
              <div>
                <dt>Source pack</dt>
                <dd>{step < 2 ? rulePackSeptember20.version : rulePack.version}</dd>
              </div>
            </dl>
            {step === 2 && (
              <div
                className={styles.entryControls}
                role="group"
                aria-label="Sample entries per path"
              >
                <button aria-pressed={entries === 2} onClick={() => setEntries(2)}>
                  Two entries
                </button>
                <button aria-pressed={entries === 1} onClick={() => setEntries(1)}>
                  One entry
                </button>
              </div>
            )}
            <p className={styles.scope}>
              This checks one submission-limit requirement. Other requirements still need their own
              facts; a supported finding is not overall eligibility or organizer approval.
            </p>
          </div>

          <div className={styles.evidence}>
            <div className={styles.evidenceHeading}>
              <BookOpen size={18} />
              <h3>Entries in the same path</h3>
            </div>
            {step === 0 ? (
              <div className={styles.sources}>
                {[oldFaq, oldContest].map((source) => (
                  <article key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      <ArrowUpRight size={14} />
                    </a>
                    <blockquote>“{source.quote}”</blockquote>
                    <small>Captured {source.capturedAt}</small>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className={styles.finding} aria-live="polite">
                  <StatusTag status={finding.status} />
                  <p>{finding.reason}</p>
                </div>
                {step === 1 ? (
                  <div className={styles.ruleRecord}>
                    <h4>The structured requirement behind this finding</h4>
                    <dl>
                      <div>
                        <dt>Fact checked</dt>
                        <dd>
                          <code>
                            {'fact' in savedFinding.rule.check
                              ? savedFinding.rule.check.fact
                              : 'entriesPerPath'}
                          </code>{' '}
                          = 2
                        </dd>
                      </div>
                      <div>
                        <dt>Condition</dt>
                        <dd>At most one entry per path</dd>
                      </div>
                      <div>
                        <dt>Source review</dt>
                        <dd>Organizer clarification required</dd>
                      </div>
                    </dl>
                    <p>{savedFinding.rule.question}</p>
                  </div>
                ) : (
                  <div className={styles.sourceUpdate}>
                    <a href={newContest.url} target="_blank" rel="noreferrer">
                      {newContest.title}
                      <ArrowUpRight size={14} />
                    </a>
                    <blockquote>“{newContest.quote}”</blockquote>
                    <small>Captured {newContest.capturedAt}</small>
                    <p>
                      <strong>{entryChange.title}</strong>: {entryChange.detail}
                    </p>
                    <p>
                      Next step:{' '}
                      {entries === 2
                        ? 'Choose one entry for this path.'
                        : 'Check the remaining requirements for your project.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        <div className={styles.stepActions}>
          {step > 0 ? (
            <button className="secondary-button" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <Link href="/review">Skip to my review</Link>
          )}
          {step < 2 ? (
            <button className="primary-button" onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Check the sample facts' : 'Apply the September 24 update'}
              <ArrowRight size={16} />
            </button>
          ) : (
            <Link className={styles.primaryLink} href="/review">
              Start my review <ArrowRight size={16} />
            </Link>
          )}
        </div>

        <section className={styles.contextProof} aria-labelledby="context-proof-title">
          <div>
            <h2 id="context-proof-title">Where Sanity Context enters the check.</h2>
            <p>
              The agent reads relevant Knowledge Base entries, quotes the facts in the question, and
              calls the typed checker. This completed run shows the source it actually read.
            </p>
          </div>
          <div className={styles.receipt}>
            <div className={styles.receiptHeading}>
              <strong>Recorded live run · September 22, 2026</strong>
              <span>{(receipt.elapsedMs / 1000).toFixed(1)}s</span>
            </div>
            <p className={styles.receiptQuestion}>“{receipt.question}”</p>
            <dl className={styles.proofChain}>
              <div>
                <dt>Sanity Content Lake</dt>
                <dd>
                  {teamRule.title}: {teamRule.summary}
                  <code>
                    {'fact' in teamRule.check && `${teamRule.check.fact} ≤ ${teamRule.check.value}`}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Context entry retrieved</dt>
                <dd>
                  <code>{teamRead.path}</code>
                  <span>Linked requirement: {teamRule.title}</span>
                </dd>
              </div>
              <div>
                <dt>Fact quoted from the question</dt>
                <dd>“{quotedTeamFact.quote}”</dd>
              </div>
              <div>
                <dt>Typed result</dt>
                <dd>
                  <StatusTag status={statusSchema.parse(receipt.actual)} />
                  <span>
                    {quotedTeamFact.value} people on the team; the rule allows at most{' '}
                    {'value' in teamRule.check ? teamRule.check.value : 4}.
                  </span>
                </dd>
              </div>
            </dl>
            <KnowledgeBaseReads entries={receipt.sourceRecords} id="kbyrY7h8fTnL" />
            <AgentTrace steps={receipt.trace.map((trace) => traceStepSchema.parse(trace))} />
            <p className={styles.scope}>
              Saved receipt, not a new request. This selected check does not establish overall
              eligibility.
            </p>
          </div>
        </section>

        <section className={styles.liveSection} aria-labelledby="live-demo-title">
          <div className={styles.liveHeading}>
            <div>
              <h2 id="live-demo-title">Try a live source question.</h2>
              <p>
                Optional. A new run retrieves Context entries and shows the actual reads and checks.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setLiveOpen(!liveOpen)}
              aria-expanded={liveOpen}
              aria-controls="live-demo-form"
            >
              {liveOpen ? 'Close live question' : 'Open live question'}
              <ArrowRight size={16} />
            </button>
          </div>
          <p className={styles.scope}>
            Live AI shares five runs per ten minutes, with additional network limits. The
            walkthrough above stays available when the allowance is busy.
          </p>
          <div id="live-demo-form" hidden={!liveOpen}>
            {liveOpen && (
              <AskFinePrint
                dossier={sample}
                initialQuestion="I am planning two entries in Path One. Is that allowed?"
                onApply={() => {}}
                onRemember={() => {}}
                onManualReview={() => setLiveOpen(false)}
                onSources={() => {
                  setStep(0);
                  document
                    .getElementById('demo-step-title')
                    ?.scrollIntoView({ block: 'start', behavior: 'instant' });
                }}
                sampleOnly
              />
            )}
          </div>
        </section>
        <footer className={styles.footer}>
          <Link href="/review">
            Check my own project <ArrowRight size={15} />
          </Link>
          <a href="https://github.com/himanshu748/fineprint" target="_blank" rel="noreferrer">
            Inspect the source code <ArrowUpRight size={15} />
          </a>
        </footer>
      </main>
    </div>
  );
}
