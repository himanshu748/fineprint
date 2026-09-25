import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileSearch,
} from 'lucide-react';
import { checkDossier } from '@/lib/engine';
import { examples, rulePack } from '@/lib/rules';
import { runScenarios } from '@/lib/scenarios';
import type { Status } from '@/lib/model';
import { gibcRulePack } from '@/lib/gibc-rules';
import recorded from '../../../evaluation/live-context.json';
import { RecordedAnswer } from './product-demo';
import { Bento } from './landing-bento';
import { RevealRoot, Ticker } from './landing-motion';
import './landing.css';

const questions = [
  {
    question: 'Is a FinePrint report an eligibility decision?',
    answer:
      'No. A report shows which rules apply to the facts you declared and what supports each finding. Only the organizer decides eligibility. Unknown facts stay unknown.',
  },
  {
    question: 'Which events are covered?',
    answer:
      'Curated rule packs for the DEV Sanity Challenge and GIBC V2 Open Invention, each dated to when its official sources were captured. Other tracks and sponsor prize conditions are outside coverage.',
  },
  {
    question: 'Where is my review saved?',
    answer:
      'In this browser. No account is needed. Download a facts backup to move to another browser, or a Markdown report to keep the findings.',
  },
  {
    question: 'What does the AI see?',
    answer:
      'Ordinary rule checks do not use AI. When you ask a question, the question and the facts you include are sent to the model, which reads the Sanity Knowledge Base. A repository review sends the selected files. Your reviews are never written to the public dataset.',
  },
];

export function LandingPage() {
  const run = recorded.results.find((result) => result.ruleId === 'origin')!;
  const before = checkDossier(examples[1].dossier, rulePack, '2026-09-22T10:00:00.000Z');
  const after = checkDossier(
    { ...examples[1].dossier, origin: 'components' },
    rulePack,
    before.checkedAt,
  );
  const comparison = ['origin', 'start', 'credit'].map((id) => ({
    id,
    title: before.findings.find((row) => row.rule.id === id)!.rule.title,
    before: before.findings.find((row) => row.rule.id === id)!.status,
    after: after.findings.find((row) => row.rule.id === id)!.status,
  }));
  const regression = runScenarios();
  const source = rulePack.sources[2];
  const ruleTitles = [
    ...new Set([...rulePack.requirements, ...gibcRulePack.requirements].map((rule) => rule.title)),
  ];
  const requirementCount = rulePack.requirements.length + gibcRulePack.requirements.length;
  return (
    <div className="product-landing">
      <a className="skip-link" href="/review">
        Skip to review desk
      </a>
      <header className="product-header">
        <a className="product-brand" href="/" aria-label="FinePrint home">
          <FileSearch size={26} strokeWidth={1.65} />
          FinePrint<span>.</span>
        </a>
        <nav aria-label="Landing navigation">
          <a href="#how-it-works">How it works</a>
          <Link href="/review">
            My reviews
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <RevealRoot>
        <main>
          <section className="fp-hero" aria-labelledby="hero-title">
            <div className="fp-dots" aria-hidden="true" />
            <a
              className="fp-pill"
              href="https://dev.to/challenges/sanity-2026-09-16"
              rel="noreferrer"
              target="_blank"
            >
              <span>Path One</span>
              Built for the DEV x Sanity Challenge
              <ArrowUpRight size={14} />
            </a>
            <h1 id="hero-title">
              A great project.
              <br />
              One overlooked <em>rule.</em>
            </h1>
            <p>
              Ask whether your hackathon project qualifies. FinePrint quotes your facts, checks each
              rule and shows the source.
            </p>
            <div className="fp-actions">
              <Link className="product-cta fp-cta" href="/review">
                Start a free review
                <ArrowRight size={18} />
              </Link>
              <a className="fp-secondary" href="#how-it-works">
                See a recorded run
                <ArrowDown size={16} />
              </a>
            </div>
          </section>

          <section className="fp-stage" id="how-it-works" aria-label="Recorded agent run">
            <div className="fp-glow" aria-hidden="true" />
            <div className="fp-frame">
              <div className="fp-chrome" aria-hidden="true">
                <span />
                <span />
                <span />
                <em>Recorded run, September 20, 2026</em>
              </div>
              <div className="fp-frame-body">
                <RecordedAnswer
                  scenario="My app existed before the event. I added a Sanity feature during it."
                  status={run.engineStatus as Status}
                  answer={run.text.split('. ').slice(0, 2).join('. ') + '.'}
                  paths={run.paths}
                  recordedOn="September 20, 2026"
                />
                <div className="source-demonstration">
                  <div className="demo-document-heading">
                    <BookOpen size={18} />
                    <strong>Rule and source</strong>
                    <span>Illustrative project</span>
                  </div>
                  <details open id="recorded-source">
                    <summary>
                      <span>
                        <small>Entry eligibility</small>
                        <strong>Development start</strong>
                      </span>
                      <span className="status-tag blocked">Blocked</span>
                    </summary>
                    <div className="source-open">
                      <p>
                        The example started in August. The official entry period began September 18.
                      </p>
                      <div className="source-fact">
                        <span>Entry development began</span>
                        <strong>2026-08-23</strong>
                      </div>
                      <blockquote>“{source.quote}”</blockquote>
                      <a href={source.url} rel="noreferrer">
                        {source.title}
                        <ArrowUpRight size={15} />
                      </a>
                      <small>Captured {source.capturedAt}</small>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </section>

          <section className="fp-rules" aria-labelledby="rules-title">
            <h2 id="rules-title">The rules FinePrint checks today</h2>
            <dl className="fp-numbers" data-reveal>
              <div>
                <dt>Curated requirements</dt>
                <dd>
                  <Ticker value={requirementCount} />
                </dd>
              </div>
              <div>
                <dt>Events with dated sources</dt>
                <dd>
                  <Ticker value={2} />
                </dd>
              </div>
              <div>
                <dt>Regression scenarios passing</dt>
                <dd>
                  <Ticker value={regression.passed} />
                  <span>/{regression.total}</span>
                </dd>
              </div>
            </dl>
            <div className="fp-marquee">
              <ul>
                {ruleTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
              <ul aria-hidden="true">
                {ruleTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
            <p className="fp-rules-note">
              Requirement titles from the Sanity Challenge and GIBC V2 Open Invention packs. The
              scenarios are authored regression cases, not an accuracy study.
            </p>
          </section>

          <Bento comparison={comparison} />

          <section className="fp-imported" aria-labelledby="imported-title" data-reveal>
            <div>
              <h2 id="imported-title">Checking a different hackathon?</h2>
              <p>
                Paste its rules link. FinePrint imports the rules as a separate pack and labels it
                as imported. No one has reviewed it against the official pages, so treat every
                finding as a starting point.
              </p>
              <Link className="fp-text-link" href="/review">
                Start a review
                <ArrowRight size={15} />
              </Link>
            </div>
            <ul className="fp-packs" aria-label="Rule pack labels">
              <li>
                <strong>Sanity Challenge</strong>
                <span className="fp-pack-tag">
                  Curated, captured {rulePack.sources[0].capturedAt}
                </span>
              </li>
              <li>
                <strong>GIBC V2 Open Invention</strong>
                <span className="fp-pack-tag">
                  Curated, captured {gibcRulePack.sources[0].capturedAt}
                </span>
              </li>
              <li className="fp-pack-imported">
                <strong>A rules link you paste</strong>
                <span className="fp-pack-tag">Imported, not reviewed</span>
              </li>
            </ul>
          </section>

          <section className="fp-faq" aria-labelledby="faq-title">
            <h2 id="faq-title">Before you rely on a report</h2>
            <div className="fp-answers">
              {questions.map(({ question, answer }) => (
                <details key={question}>
                  <summary>
                    {question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="fp-close" aria-labelledby="close-title">
            <div className="fp-close-dots" aria-hidden="true" />
            <h2 id="close-title">
              Before you hit submit, read the <em>FinePrint.</em>
            </h2>
            <p>Create a review. Keep the sources and your next steps together.</p>
            <Link className="product-cta fp-cta fp-cta-light" href="/review">
              Start a free review
              <ArrowRight size={18} />
            </Link>
          </section>
        </main>
      </RevealRoot>
      <footer className="product-footer">
        <a className="product-brand" href="/">
          FinePrint.
        </a>
        <p>
          Free rule checks. An agent on Sanity Context. Built with Sanity and Modal.
          <br />A review is not an eligibility certificate or organizer approval.
        </p>
        <a href="https://dev.to/challenges/sanity-2026-09-16" rel="noreferrer">
          The Sanity Challenge
          <ArrowUpRight size={15} />
        </a>
      </footer>
    </div>
  );
}
