'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { checkDossier } from '@/lib/engine';
import { examples, rulePack, rulePackSeptember20 } from '@/lib/rules';
import { StatusTag } from '../status-tag';

export function RuleRecheck() {
  const [revised, setRevised] = useState(true);
  const [entries, setEntries] = useState(2);
  const pack = revised ? rulePack : rulePackSeptember20;
  const finding = checkDossier(
    { ...examples[2].dossier, entriesPerPath: entries },
    pack,
    '2026-09-24T12:00:00.000Z',
  ).findings.find((row) => row.rule.id === 'entry-limit')!;
  const source = pack.sources.find((row) => row.id === 'contest')!;

  return (
    <div className="fp-recheck" role="group" aria-label="Try the dated submission-limit check">
      <div className="fp-recheck-heading">
        <h2>A changed rule. A different finding.</h2>
        <span>Sanity Challenge · Path One</span>
      </div>
      <div className="fp-recheck-controls">
        <fieldset>
          <legend>Official rules captured</legend>
          <div>
            <button aria-pressed={!revised} onClick={() => setRevised(false)}>
              Sep 20
            </button>
            <button aria-pressed={revised} onClick={() => setRevised(true)}>
              Sep 24
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Your declared entries</legend>
          <div>
            <button aria-pressed={entries === 1} onClick={() => setEntries(1)}>
              One
            </button>
            <button aria-pressed={entries === 2} onClick={() => setEntries(2)}>
              Two
            </button>
          </div>
        </fieldset>
      </div>
      <div className="fp-recheck-source">
        <a href={source.url} target="_blank" rel="noreferrer">
          Contest rules <ArrowRight size={14} />
        </a>
        <blockquote>“{source.quote}”</blockquote>
        {!revised && (
          <p>The FAQ already limited entries to one per path. These sources disagreed.</p>
        )}
      </div>
      <div
        className="fp-recheck-result"
        aria-live="polite"
        aria-atomic="true"
        data-status={finding.status}
      >
        <span>Submission-limit finding</span>
        <StatusTag status={finding.status} />
        <p>{finding.reason}</p>
      </div>
      <p className="fp-recheck-scope">
        Illustrative entry · real dated sources · computed without AI. This checks one rule, not
        overall eligibility.
      </p>
    </div>
  );
}
