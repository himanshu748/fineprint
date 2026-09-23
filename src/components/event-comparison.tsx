'use client';
import { StatusTag, statusLabels as labels } from './status-tag';

import { useEffect, useState } from 'react';
import { ArrowRight, GitCompareArrows, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import {
  dossierSchema,
  eventIdSchema,
  factLabels,
  reportSchema,
  type Dossier,
  type EventId,
  type Report,
  type RulePack,
} from '@/lib/model';
import { checkDossier, formatFact } from '@/lib/engine';
import {
  eventCatalog,
  eventDetails,
  eventPhase,
  factsForEvent,
  portableFacts,
  savedPacks,
} from '@/lib/events';
import { ruleImpact } from '@/lib/rule-impact';

const comparisonSchema = z.object({
  reports: z.array(reportSchema).max(2),
  unavailable: z.array(eventIdSchema),
});
export function EventComparison({
  dossier,
  packs,
  onSave,
}: {
  dossier: Dossier;
  packs: Partial<Record<EventId, RulePack>>;
  onSave: (facts: Dossier) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState<EventId[]>([]);
  const [snapshot, setSnapshot] = useState(false);
  const [submitted, setSubmitted] = useState('');
  async function compare(useSnapshot = false) {
    const parsed = dossierSchema.safeParse(dossier);
    if (!parsed.success) {
      setError('Finish or clear invalid dates and numbers in the review before comparing.');
      return;
    }
    setBusy(true);
    setError('');
    setReports([]);
    setUnavailable([]);
    try {
      if (useSnapshot)
        setReports(
          eventCatalog.map((event) =>
            checkDossier(factsForEvent(parsed.data, event.id), savedPacks[event.id]),
          ),
        );
      else {
        const response = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
          signal: AbortSignal.timeout(25_000),
        });
        if (!response.ok) throw new Error();
        const data = comparisonSchema.parse(await response.json());
        setReports(data.reports as Report[]);
        setUnavailable(data.unavailable);
      }
      setSnapshot(useSnapshot);
      setSubmitted(JSON.stringify(dossier));
    } catch {
      setError(
        'Current rules could not be loaded. Retry, or explicitly use the dated saved packs below.',
      );
    } finally {
      setBusy(false);
    }
  }
  // A comparison starts only after the user opens this view. It uses no model requests.
  useEffect(() => {
    void compare();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stale = submitted && submitted !== JSON.stringify(dossier);
  return (
    <div className="event-comparison secondary-view">
      <div className="comparison-heading">
        <div>
          <h1>Where does {dossier.name || 'your project'} stand?</h1>
          <p>
            Compare selected checks across two curated events. A supported finding is not complete
            eligibility.
          </p>
        </div>
        <button className="secondary-button" disabled={busy} onClick={() => void compare()}>
          <RefreshCw size={16} />
          {busy ? 'Comparing…' : 'Refresh comparison'}
        </button>
      </div>
      <div className="comparison-facts">
        <GitCompareArrows size={23} />
        <div>
          <strong>Shared project facts</strong>
          <p>
            {portableFacts
              .filter((key) => key !== 'name' && dossier[key] !== null)
              .map((key) => `${factLabels[key]}: ${formatFact(dossier[key])}`)
              .join(' · ') || 'No shared facts supplied yet.'}
          </p>
          <small>
            Other events start with unanswered event-specific questions. What existed before each
            event, residency declarations, organizer relationships and submission materials are not
            copied.
          </small>
        </div>
      </div>
      {(error || unavailable.length > 0) && (
        <div className="error-banner" role="alert">
          <span>
            {error ||
              `Rules unavailable for ${unavailable.map((id) => eventDetails(id).shortTitle).join(', ')}. No verdict was guessed.`}
          </span>
          <button disabled={busy} onClick={() => void compare(true)}>
            Use dated saved packs
          </button>
        </div>
      )}
      {snapshot && (
        <p className="warning-banner">
          Using dated local source snapshots. This comparison has not refreshed Sanity.
        </p>
      )}
      {stale && <p className="warning-banner">Project facts changed. Refresh this comparison.</p>}
      {busy && <p role="status">Reading the current curated packs…</p>}
      <div className="event-comparison-grid">
        {reports.map((report) => {
          const event = eventDetails(report.dossier.eventId);
          const pack = packs[event.id] ?? savedPacks[event.id];
          return (
            <article className="comparison-event" key={event.id}>
              <header>
                <span className="event-mark">{event.mark}</span>
                <div>
                  <h2>{event.shortTitle}</h2>
                  <p>{event.coverage}</p>
                </div>
                <span className="event-phase">{eventPhase(pack)}</span>
              </header>
              <p className="comparison-deadline">
                Closes {new Date(pack.deadline).toLocaleString()} <span>(your time)</span>
              </p>
              <h3>{report.summary}</h3>
              <p>
                {report.counts.blocked} blocked · {report.counts.missing} missing facts ·{' '}
                {report.counts.unclear} unclear
              </p>
              <div className="comparison-key-findings">
                {report.findings
                  .filter((f) => ['team', 'start', 'gibc-team', 'gibc-start'].includes(f.rule.id))
                  .map((finding) => (
                    <div key={finding.rule.id}>
                      <div>
                        <strong>{finding.rule.title.replace('GIBC: ', '')}</strong>
                        <small>{finding.rule.summary}</small>
                      </div>
                      <StatusTag status={finding.status} />
                    </div>
                  ))}
              </div>
              <details className="comparison-details">
                <summary>Inspect all {report.findings.length} checks and sources</summary>
                {report.findings.map((finding) => (
                  <div className="comparison-finding" key={finding.rule.id}>
                    <strong>{finding.rule.title.replace('GIBC: ', '')}</strong>
                    <StatusTag status={finding.status} />
                    <p>{finding.reason}</p>
                    {finding.rule.sources.map((id) => {
                      const source = report.sources.find((s) => s.id === id)!;
                      return (
                        <a key={id} href={source.url} rel="noreferrer">
                          {source.title}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </details>
              <div className="comparison-event-footer">
                <small>
                  Pack {report.packVersion} ·{' '}
                  {report.sourceMode === 'sanity' ? 'Read from Sanity' : 'Local snapshot'}
                  <br />
                  Official sources captured{' '}
                  {report.sources
                    .map((s) => s.capturedAt)
                    .sort()
                    .at(-1)}
                </small>
                <button
                  className="secondary-button"
                  disabled={busy || Boolean(stale)}
                  onClick={() => onSave(report.dossier)}
                >
                  Create {event.shortTitle} review <ArrowRight size={15} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="comparison-footnote">
        This checks the same project against each event separately. It does not establish permission
        to submit the same work to both. GIBC excludes substantially repeated hackathon entries.
        Verify that question before reusing a submission.
      </p>
      {reports.length > 0 && (
        <RuleRehearsal
          report={reports.find((r) => r.packId === 'gibc-v2-2026') ?? reports[0]}
          pack={packs['gibc-v2-2026'] ?? savedPacks['gibc-v2-2026']}
        />
      )}
    </div>
  );
}

function RuleRehearsal({ report, pack }: { report: Report; pack: RulePack }) {
  const [limit, setLimit] = useState(3);
  if (report.packId !== pack.id) return null;
  const hypothetical = {
    ...pack,
    version: `${pack.version}-rehearsal`,
    requirements: pack.requirements.map((rule) =>
      rule.id === 'gibc-team' && limit !== 6
        ? {
            ...rule,
            summary: `Rehearsal: maximum ${limit} members.`,
            check: { op: 'lte' as const, fact: 'teamSize', value: limit },
          }
        : rule,
    ),
  };
  const before = checkDossier(report.dossier, pack, report.checkedAt);
  const after = checkDossier(report.dossier, hypothetical, report.checkedAt);
  const impact = ruleImpact(before, hypothetical)!;
  return (
    <details className="rule-rehearsal">
      <summary>
        Try a rule-change rehearsal <span>Local illustration</span>
      </summary>
      <div>
        <h2>See exactly which check would change.</h2>
        <p>
          This is a hypothetical edit. GIBC’s published limit remains six. Nothing here changes an
          official source or your saved reviews.
        </p>
        <label className="field">
          <span>Hypothetical team limit</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} members
              </option>
            ))}
          </select>
        </label>
        <strong>
          {impact.changes.length} of {pack.requirements.length} checks affected
        </strong>
        {impact.changes.map((change) => (
          <p key={change.id}>
            {change.title}: {labels[before.findings.find((f) => f.rule.id === change.id)!.status]} →{' '}
            {labels[after.findings.find((f) => f.rule.id === change.id)!.status]}
          </p>
        ))}
        <small>
          When a requirement changes, an unknown team size still produces “Missing fact”.
        </small>
      </div>
    </details>
  );
}
