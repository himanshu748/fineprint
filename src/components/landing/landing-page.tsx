import { RecordedComparison } from './recorded-comparison';
import multiEvent from '../../../evaluation/multi-event-context.json';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, FileSearch } from 'lucide-react';
import { checkDossier } from '@/lib/engine';
import { examples, rulePack } from '@/lib/rules';
import recorded from '../../../evaluation/live-context.json';
import { RecordedAnswer, FactChange } from './product-demo';
import './landing.css';

export function LandingPage() {
  const conflict = rulePack.requirements.find((rule) => rule.id === 'entry-limit')!;
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
          <a href="#sources">How it works</a>
          <Link href="/review">
            My reviews
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="product-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              A great project.
              <br />
              One overlooked <em>rule.</em>
            </h1>
            <p>
              You’ve done the building. Before you submit, find the rule that could change your
              plans.
            </p>
            <div className="hero-actions">
              <Link className="product-cta" href="/review">
                Start a free review
                <ArrowRight size={18} />
              </Link>
              <a href="#sources">
                See the evidence
                <ArrowDown size={16} />
              </a>
            </div>
            <p className="hero-scope">
              Now covering Sanity Challenge and GIBC V2 Open Invention.
              <br />
              No account needed. Your work saves on this device.
            </p>
          </div>
          <RecordedAnswer
            answer={recorded.results[0].text.split('. ').slice(0, 2).join('. ') + '.'}
            paths={recorded.results[0].paths}
          />
        </section>
        <div className="product-context">
          <span>
            Your project. <strong>Your saved review.</strong>
          </span>
          <p>
            Start with what you know, follow the next question, and return when your project
            changes. Each finding keeps its official source.
          </p>
        </div>
        <section className="product-section" id="sources" aria-labelledby="sources-title">
          <div className="section-copy">
            <h2 id="sources-title">An answer is only useful if you can check it.</h2>
            <p>
              Open a finding and follow it to the official rule. See what was checked, which facts
              were used and when the source was captured.
            </p>
            <a className="product-text-link" href="/review">
              Check your project
              <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="source-demonstration">
            <div className="demo-document-heading">
              <BookOpen size={18} />
              <strong>Rule & sources</strong>
              <span>Illustrative project</span>
            </div>
            <details open>
              <summary>
                <span>
                  <small>Entry eligibility</small>
                  <strong>Development start</strong>
                </span>
                <span className="status-tag blocked">Blocked</span>
              </summary>
              <div className="source-open">
                <p>The example started in August. The official entry period began September 18.</p>
                <div className="source-fact">
                  <span>Entry development began</span>
                  <strong>2026-08-23</strong>
                </div>
                <blockquote>“{rulePack.sources[2].quote}”</blockquote>
                <a href={rulePack.sources[2].url} rel="noreferrer">
                  {rulePack.sources[2].title}
                  <ArrowUpRight size={15} />
                </a>
                <small>
                  Captured {rulePack.sources[2].capturedAt} · {rulePack.sources[2].version}
                </small>
              </div>
            </details>
            <p className="source-footnote">
              A source is a rule. Your project facts are declarations. FinePrint keeps that
              distinction visible.
            </p>
          </div>
        </section>
        <section className="conflict-section" id="conflict" aria-labelledby="conflict-title">
          <div className="conflict-heading">
            <h2 id="conflict-title">
              Two official sources.
              <br />
              Two different answers.
            </h2>
            <p>
              That happens. FinePrint keeps both claims in view and gives you the question to take
              to the organizer.
            </p>
          </div>
          <div className="conflict-documents">
            {rulePack.sources.slice(0, 2).map((source, index) => (
              <article key={source.id}>
                <div className="conflict-source">
                  <BookOpen size={18} />
                  <a href={source.url} rel="noreferrer">
                    {source.title}
                    <ArrowUpRight size={16} />
                  </a>
                </div>
                <blockquote>
                  {index === 0 ? (
                    <>
                      “No, <mark>only one submission per path</mark> is allowed.”
                    </>
                  ) : (
                    <>
                      “There is <mark>no limit on the number of Entries</mark> you may submit during
                      the Entry Period.”
                    </>
                  )}
                </blockquote>
                <small>Official source snapshot · {source.capturedAt}</small>
              </article>
            ))}
          </div>
          <div className="conflict-resolution">
            <span className="status-tag unclear">Rules unclear</span>
            <p>{conflict.question}</p>
            <Link href="/review">
              Start a review
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="product-section" id="compare" aria-labelledby="compare-title">
          <div className="section-copy">
            <h2 id="compare-title">
              Change the fact.
              <br />
              See what follows.
            </h2>
            <p>
              Reusing a component and resubmitting an app are different situations. Change that fact
              and watch the relevant check update.
            </p>
            <p className="section-aside">
              The development date stays in August. One corrected fact doesn’t erase a separate
              blocker.
            </p>
          </div>
          <FactChange rows={comparison} />
        </section>
        <section className="product-section" aria-labelledby="events-title">
          <div className="section-copy">
            <h2 id="events-title">
              Same project.
              <br />
              Different rulebooks.
            </h2>
            <p>
              A five-person team fits GIBC’s team-size check and exceeds Sanity’s limit. Compare
              your project across both, with a source behind each result.
            </p>
            <p className="section-aside">
              When a curated rule changes, see which saved findings need another check. Your
              previous report stays available for comparison.
            </p>
            <Link className="product-text-link" href="/review">
              Start a review, then compare events <ArrowUpRight size={16} />
            </Link>
          </div>
          <RecordedComparison results={multiEvent.results} />
        </section>
        <section className="product-close">
          <div>
            <h2>
              Before you hit submit,
              <br />
              read the FinePrint.
            </h2>
            <p>Create a review. Keep the sources and your next steps together.</p>
          </div>
          <Link className="product-cta" href="/review">
            Start a free review
            <ArrowRight size={19} />
          </Link>
        </section>
      </main>
      <footer className="product-footer">
        <a className="product-brand" href="/">
          FinePrint.
        </a>
        <p>
          Free rule checks. Optional AI help. Built with Sanity Context and Modal.
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
