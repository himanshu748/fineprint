import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown } from 'lucide-react';
import { checkDossier } from '@/lib/engine';
import { examples, rulePack, rulePackSeptember20 } from '@/lib/rules';
import type { RulePack, Status } from '@/lib/model';
import { StatusTag, statusLabels } from '../status-tag';
import { FactChange } from './product-demo';
import { RecordedComparison } from './recorded-comparison';
import multiEvent from '../../../evaluation/multi-event-context.json';

type Row = { id: string; title: string; before: Status; after: Status };

function RuleChangeTile() {
  const contest = (pack: RulePack) => pack.sources.find((source) => source.id === 'contest')!;
  const quotes = [rulePackSeptember20, rulePack].map((pack) => contest(pack));
  const limit = (pack: RulePack, checkedAt: string) =>
    checkDossier(examples[2].dossier, pack, checkedAt).findings.find(
      (finding) => finding.rule.id === 'entry-limit',
    )!;
  const saved = limit(rulePackSeptember20, '2026-09-22T12:00:00.000Z');
  const current = limit(rulePack, '2026-09-24T12:00:00.000Z');
  return (
    <article className="fp-tile fp-tile-conflict" id="rule-change" data-reveal>
      <div className="fp-tile-copy">
        <h3>The contest rules changed. Saved reviews show it.</h3>
        <p>
          The contest rules page said one thing on September 20 and another on September 24.
          FinePrint published a new dated pack and kept the old one, so a saved review names the
          change.
        </p>
      </div>
      <div className="fp-quotes">
        {quotes.map((source, index) => (
          <figure key={source.capturedAt} className={`fp-quote fp-quote-${index + 1}`}>
            <figcaption>
              <BookOpen size={15} />
              <a href={source.url} rel="noreferrer">
                {source.title}
                <ArrowUpRight size={14} />
              </a>
            </figcaption>
            <blockquote>
              {index === 0 ? (
                <>
                  “There is <mark>no limit on the number of Entries</mark> you may submit during the
                  Entry Period.”
                </>
              ) : (
                <>
                  “<mark>Only one submission per path</mark> is allowed.”
                </>
              )}
            </blockquote>
            <small>Official source snapshot, {source.capturedAt}</small>
          </figure>
        ))}
      </div>
      <div className="fp-conflict-question">
        <span className="fp-status-change">
          <StatusTag status={saved.status} />
          <ArrowRight size={16} aria-hidden="true" />
          <StatusTag status={current.status} />
        </span>
        <p>
          A saved review with two entries in Path One: pack {rulePackSeptember20.version} marked it{' '}
          {statusLabels[saved.status]}. Pack {rulePack.version} marks it{' '}
          {statusLabels[current.status]}, with both official pages quoting the same limit.
        </p>
      </div>
    </article>
  );
}

function SourceTile() {
  const source = rulePack.sources[2];
  return (
    <article className="fp-tile fp-tile-source" data-reveal>
      <div className="fp-finding" aria-hidden="true">
        <div className="fp-finding-row">
          <span>
            <small>Entry eligibility</small>
            <strong>Development start</strong>
          </span>
          <span className="status-tag blocked">Blocked</span>
          <ChevronDown size={16} className="fp-finding-chevron" />
        </div>
        <div className="fp-finding-source">
          <div className="fp-finding-fact">
            <span>Entry development began</span>
            <strong>2026-08-23</strong>
          </div>
          <blockquote>“{source.quote}”</blockquote>
          <small>
            {source.title}, captured {source.capturedAt}
          </small>
        </div>
      </div>
      <div className="fp-tile-copy">
        <h3>Every finding opens to its source.</h3>
        <p>See the fact that was used, the official wording and when it was captured.</p>
        <small>Illustrative project, real rule text.</small>
      </div>
    </article>
  );
}

export function Bento({ comparison }: { comparison: Row[] }) {
  return (
    <section className="fp-bento-section" id="features" aria-labelledby="features-title">
      <div className="fp-section-head" data-reveal>
        <h2 id="features-title">An answer is only useful if you can check it.</h2>
        <p>
          Your project facts are declarations. The rules are quotes. FinePrint keeps the two apart
          and shows how each finding was reached.
        </p>
      </div>
      <div className="fp-bento">
        <RuleChangeTile />
        <SourceTile />
        <article className="fp-tile fp-tile-change" data-reveal>
          <div className="fp-tile-copy">
            <h3>Change one fact. See what follows.</h3>
            <p>Reusing components and resubmitting an app are different situations.</p>
          </div>
          <FactChange rows={comparison} />
        </article>
        <article className="fp-tile fp-tile-compare" data-reveal>
          <div className="fp-tile-copy">
            <h3>Same project. Different rulebooks.</h3>
            <p>
              A five-person team fits GIBC’s team-size rule and exceeds Sanity’s limit. These are
              recorded agent runs with their source reads.
            </p>
            <Link className="fp-text-link" href="/review">
              Start a review, then compare events
              <ArrowRight size={15} />
            </Link>
          </div>
          <RecordedComparison results={multiEvent.results} />
        </article>
        <article className="fp-tile fp-tile-repo" data-reveal>
          <div className="fp-tile-copy">
            <h3>Bring the code. Find the evidence.</h3>
            <p>
              Review a public GitHub repository against Sanity or GIBC judging criteria. Each
              finding points to inspected lines. It helps you prepare; it does not predict a score.
            </p>
            <Link className="fp-text-link" href="/repository">
              Review your GitHub repository
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <ul className="fp-repo-facts">
            <li>
              <strong>Fixed commit</strong>
              <span>The default branch is pinned before any file is read.</span>
            </li>
            <li>
              <strong>10 files</strong>
              <span>Up to 60,000 characters of readable text per review.</span>
            </li>
            <li>
              <strong>Line citations</strong>
              <span>Citations that do not match inspected lines are discarded.</span>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
