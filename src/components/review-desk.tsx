'use client';
import { StatusTag, statusLabels } from './status-tag';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileSearch,
  Files,
  GitCompareArrows,
  LoaderCircle,
  Plus,
  Search,
  ShieldQuestion,
  SlidersHorizontal,
  MessageSquareText,
  Sparkles,
  X,
} from 'lucide-react';
import {
  dossierSchema,
  savedCaseSchema,
  reportSchema,
  factLabels,
  type Dossier,
  type FactKey,
  type Finding,
  type Report,
  type Scope,
  type Status,
} from '@/lib/model';
import { blankDossier, examples, rulePack } from '@/lib/rules';
import { checkDossier, changedFindings, formatFact, reportMarkdown } from '@/lib/engine';
import { eventCatalog, eventDetails, savedPacks, eventPhase } from '@/lib/events';
import { ruleImpact } from '@/lib/rule-impact';
import { EventComparison } from './event-comparison';
import { GibcFacts } from './gibc-facts';
import { useRulePacks } from './use-rule-packs';
import { ReviewLibrary, downloadText } from './review-library';
import { useReviews } from './use-reviews';
import {
  exportWorkspace,
  importWorkspace,
  maxReviews,
  mergeAnswerFacts,
  newReview,
  nextFact,
  type PersonalReview,
} from '@/lib/review-workspace';
import type { AskResponse } from '@/lib/agent-schema';
import { AgentAccessForm } from './agent-access-form';
import { AskFinePrint } from './ask-fineprint';
import { AgentTrace } from './agent-trace';
import type { TraceStep } from '@/lib/agent-trace';

type SavedCase = { id: string; name: string; savedAt: string; dossier: Dossier; report: Report };
type View = 'compare' | 'reviews' | 'review' | 'sources' | 'saved' | 'evaluation' | 'connection';
type Pane = 'facts' | 'findings' | 'sources';
const scopeLabels: Record<Scope, string> = {
  entry: 'Entry eligibility',
  path: 'Path requirements',
  prize: 'Prize eligibility',
  combination: 'Prize combinations',
  submission: 'Submission readiness',
};
const storageKey = 'fineprint.cases.v1';

function StatusIcon({ status, size = 17 }: { status: Status; size?: number }) {
  const Icon =
    status === 'supported'
      ? CircleCheck
      : status === 'blocked'
        ? CircleAlert
        : status === 'unclear'
          ? ShieldQuestion
          : status === 'not-applicable'
            ? Check
            : CircleHelp;
  return <Icon size={size} aria-hidden="true" className={`status-icon ${status}`} />;
}
function TriSelect({
  field,
  dossier,
  onChange,
  help,
}: {
  field: FactKey;
  dossier: Dossier;
  onChange: (field: FactKey, value: unknown) => void;
  help?: string;
}) {
  const value = dossier[field];
  return (
    <label className="field" data-field={field}>
      <span>{factLabels[field]}</span>
      <select
        value={value === null ? 'unknown' : value ? 'yes' : 'no'}
        onChange={(e) =>
          onChange(field, e.target.value === 'unknown' ? null : e.target.value === 'yes')
        }
      >
        <option value="unknown">Not sure yet</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      {help && <small>{help}</small>}
    </label>
  );
}
function downloadReport(report: Report) {
  const url = URL.createObjectURL(
    new Blob([reportMarkdown(report)], { type: 'text/markdown;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `fineprint-${report.dossier.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${report.checkedAt.slice(0, 10)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReviewDesk() {
  const reviews = useReviews();
  const catalog = useRulePacks();
  const [hydrated, setHydrated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [focusField, setFocusField] = useState<FactKey | null>(null);
  const factsRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<View>('reviews');
  const [pane, setPane] = useState<Pane>('findings');
  const [dossier, setDossier] = useState<Dossier>({
    ...blankDossier,
    entriesPerPath: null,
    seeksMultiplePrizes: null,
  });
  const [report, setReport] = useState<Report | null>(null);
  const [baseline, setBaseline] = useState<Report | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState('origin');
  const [filter, setFilter] = useState<'all' | 'attention' | 'supported'>('all');
  const [scope, setScope] = useState<'all' | 'eligibility' | 'submission'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isExample, setIsExample] = useState(false);
  const [saved, setSaved] = useState<SavedCase[]>([]);
  const [connection, setConnection] = useState({
    rules: false,
    context: false,
    model: false,
    persistence: false,
  });
  const [evaluation, setEvaluation] = useState<{
    total: number;
    passed: number;
    cases: { name: string; passed: boolean; expected: string; actual: string }[];
    baseline?: {
      runAt: string;
      model: string;
      total: number;
      completed: number;
      passed: number;
      mismatches: { name: string; status: string; expected: string }[];
    };
    multiEvent?: {
      runAt: string;
      limitations: string;
      results: {
        eventId: string;
        ruleId: string;
        expected: string;
        actual: string;
        agentInterpretation: string | null;
        citedRelevantRule: boolean;
        elapsedMs: number;
      }[];
    };
  } | null>(null);
  const [explanation, setExplanation] = useState<{
    text: string;
    mode: string;
    paths?: string[];
    trace?: TraceStep[];
  } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [access, setAccess] = useState({ required: false, available: false, authorized: false });
  const [showAccess, setShowAccess] = useState(false);
  const checkRequest = useRef(0);
  const explanationRequest = useRef(0);
  function clearExplanation() {
    explanationRequest.current++;
    setExplanation(null);
    setExplaining(false);
    setShowAccess(false);
  }

  async function runCheck(facts: Dossier, remember = true, useSnapshot = false) {
    setError('');
    const validated = dossierSchema.safeParse(facts);
    if (!validated.success) {
      setError(
        validated.error.issues
          .slice(0, 3)
          .map(
            (issue) =>
              `${factLabels[issue.path[0] as FactKey] ?? 'Project facts'}: ${issue.message}`,
          )
          .join(' '),
      );
      return;
    }
    const requestId = ++checkRequest.current;
    setBusy(true);
    clearExplanation();
    try {
      let data: Report;
      if (useSnapshot) {
        data = checkDossier(
          validated.data,
          savedPacks[validated.data.eventId],
          undefined,
          'snapshot',
        );
      } else {
        const response = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated.data),
          signal: AbortSignal.timeout(20_000),
        });
        const raw = await response.json();
        if (!response.ok) throw new Error(raw.error || 'The check did not complete. Please retry.');
        data = reportSchema.parse(raw) as Report;
      }
      if (requestId !== checkRequest.current) return;
      if (remember && report) setBaseline(report);
      setDossier(validated.data);
      setReport(data);
      setSelected((current) =>
        data.findings.some((finding) => finding.rule.id === current)
          ? current
          : data.findings[0].rule.id,
      );
      if (!useSnapshot) void catalog.refresh();
      if (remember && report) setComparing(true);
      setPane('findings');
    } catch (error) {
      if (requestId === checkRequest.current)
        setError(
          error instanceof Error ? error.message : 'The check did not complete. Please retry.',
        );
    } finally {
      if (requestId === checkRequest.current) setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(raw))
        setSaved(
          raw.slice(0, 12).flatMap((item) => {
            const parsed = savedCaseSchema.safeParse(item);
            return parsed.success ? [parsed.data as SavedCase] : [];
          }),
        );
    } catch {
      setNotice('Saved data could not be read. You can still create a new review.');
    }
    void fetch('/api/connection')
      .then((res) => res.json())
      .then(setConnection)
      .catch(() => {});
    void fetch('/api/access')
      .then((res) => res.json())
      .then(setAccess)
      .catch(() => {});
    // Read browser storage after hydration; examples never become a visitor’s project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeReview = reviews.workspace.reviews.find((r) => r.id === reviews.workspace.activeId);
  const rememberReview = reviews.update;
  useEffect(() => {
    if (!reviews.ready || hydrated) return;
    if (activeReview && !activeReview.archived) {
      setDossier(activeReview.dossier);
      setReport(activeReview.report as Report | null);
      setSelected(activeReview.report?.findings[0]?.rule.id ?? 'origin');
      setBaseline(activeReview.previousReport as Report | null);
      setAssistantOpen(Boolean(activeReview.question || activeReview.answer));
      setView('review');
    }
    setHydrated(true);
  }, [reviews.ready, hydrated, activeReview]);
  useEffect(() => {
    if (!hydrated || isExample || !reviews.workspace.activeId) return;
    rememberReview(reviews.workspace.activeId, { dossier, report, previousReport: baseline });
  }, [hydrated, isExample, reviews.workspace.activeId, dossier, report, baseline, rememberReview]);
  useEffect(() => {
    if (!focusField || pane !== 'facts' || view !== 'review') return;
    const label = factsRef.current?.querySelector<HTMLElement>(`[data-field="${focusField}"]`);
    const section = label?.closest('details');
    if (section) section.open = true;
    const input = label?.querySelector<HTMLElement>('input, select, textarea');
    input?.focus({ preventScroll: true });
    label?.scrollIntoView({ block: 'center', behavior: 'instant' });
    setFocusField(null);
  }, [focusField, pane, view]);

  function openReview(item: PersonalReview) {
    checkRequest.current++;
    clearExplanation();
    setBusy(false);
    setError('');
    reviews.activate(item.id);
    setDossier(item.dossier);
    setReport(item.report as Report | null);
    setBaseline(item.previousReport as Report | null);
    setComparing(false);
    setIsExample(false);
    setView('review');
    setPane(item.report ? 'findings' : 'facts');
    setAssistantOpen(Boolean(item.question || item.answer));
    setSelected(
      item.report?.findings.find((f) => f.status === 'blocked' || f.status === 'unclear')?.rule
        .id ??
        item.report?.findings[0]?.rule.id ??
        'origin',
    );
  }
  function createReview(
    details: Pick<Dossier, 'name' | 'track' | 'origin' | 'startedAt'> & Partial<Dossier>,
  ) {
    if (reviews.workspace.reviews.length >= maxReviews) {
      setNotice(
        'This device has reached its 30-review limit. Back up reviews you want to keep, then delete an archived review to make space.',
      );
      return false;
    }
    try {
      const item = newReview(details.name, details.track, details);
      reviews.add(item);
      checkRequest.current++;
      clearExplanation();
      setDossier(item.dossier);
      setReport(null);
      setBaseline(null);
      setComparing(false);
      setIsExample(false);
      setView('review');
      setPane('findings');
      setSelected('origin');
      setAssistantOpen(false);
      setError('');
      setNotice('');
      void runCheck(item.dossier, false);
      return true;
    } catch {
      setNotice('Add a project name and a valid start date, or leave the date blank.');
      return false;
    }
  }
  function jumpToFact(field: FactKey) {
    setView('review');
    setPane('facts');
    setFocusField(field);
  }
  function applyAnswer(answer: AskResponse) {
    const base = isExample
      ? { ...blankDossier, entriesPerPath: null, seeksMultiplePrizes: null }
      : dossier;
    const facts = mergeAnswerFacts(base, answer);
    if (!activeReview || isExample) {
      if (reviews.workspace.reviews.length >= maxReviews) {
        setNotice('The device review limit has been reached. Export your report to keep a copy.');
        return;
      }
      const item = newReview(facts.name, facts.track);
      reviews.add({ ...item, dossier: facts, question: answer.question, answer });
      setReport(null);
      setBaseline(null);
    }
    setDossier(facts);
    setIsExample(false);
    setScope('all');
    setAssistantOpen(false);
    setNotice('Quoted facts added. Your other answers and notes have been kept.');
    void runCheck(facts, Boolean(activeReview && !isExample));
  }
  const event = eventDetails(dossier.eventId);
  const currentPack = catalog.packs[dossier.eventId];
  const sourcePack = currentPack ?? savedPacks[dossier.eventId];
  const impact = report && currentPack ? ruleImpact(report, currentPack) : null;
  const rulesChanged = Boolean(impact && (impact.needsRecheck || impact.versionChanged));
  const next = nextFact(report);

  const dirty = report ? JSON.stringify(dossier) !== JSON.stringify(report.dossier) : false;
  const activeFinding = report?.findings.find((f) => f.rule.id === selected) ?? report?.findings[0];
  const changed = useMemo(
    () => (baseline && report ? changedFindings(baseline, report) : []),
    [baseline, report],
  );
  const visible = (report?.findings ?? [])
    .filter(
      (f) =>
        scope === 'all' ||
        (scope === 'eligibility' ? f.rule.scope !== 'submission' : f.rule.scope === 'submission'),
    )
    .filter(
      (f) =>
        filter === 'all' ||
        (filter === 'attention'
          ? ['blocked', 'missing', 'unclear'].includes(f.status)
          : f.status === 'supported'),
    );
  const priority: Record<string, number> = { origin: 0, start: 1, 'entry-limit': 2 };
  const groups = Object.entries(scopeLabels)
    .map(([key, label]) => ({
      key,
      label,
      findings: visible
        .filter((f) => f.rule.scope === key)
        .sort((a, b) => (priority[a.rule.id] ?? 10) - (priority[b.rule.id] ?? 10)),
    }))
    .filter((group) => group.findings.length);

  function update(field: FactKey, value: unknown) {
    setDossier((current) => ({ ...current, [field]: value }));
    checkRequest.current++;
    setBusy(false);
    clearExplanation();
  }
  function selectFinding(finding: Finding) {
    setSelected(finding.rule.id);
    setPane('sources');
    clearExplanation();
  }
  function loadExample(index: number) {
    const facts = { ...examples[index].dossier };
    setDossier(facts);
    reviews.activate(null);
    setBaseline(null);
    setComparing(false);
    setReport(null);
    setAssistantOpen(false);
    setIsExample(true);
    setView('review');
    setSelected(index === 2 ? 'entry-limit' : 'origin');
    void runCheck(facts, false);
  }
  function restoreCase(item: SavedCase) {
    if (reviews.workspace.reviews.length >= maxReviews) {
      setNotice(
        'This device has reached its review limit. You can still export this saved report.',
      );
      return;
    }
    const created = newReview(item.dossier.name, item.dossier.track);
    reviews.add({ ...created, dossier: item.dossier, report: item.report });
    openReview({ ...created, dossier: item.dossier, report: item.report });
    void runCheck(item.dossier, false);
  }
  async function explainFinding() {
    if (!activeFinding || !report) return;
    if (access.required && !access.authorized && access.available) {
      setShowAccess(true);
      return;
    }
    const requestId = ++explanationRequest.current;
    setExplaining(true);
    setExplanation(null);
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossier: report.dossier, ruleId: activeFinding.rule.id }),
      });
      const data = await response.json();
      if (response.status === 401 && data.code === 'ACCESS_REQUIRED') {
        if (requestId === explanationRequest.current) {
          setAccess((current) => ({
            ...current,
            required: true,
            available: true,
            authorized: false,
          }));
          setShowAccess(true);
        }
        return;
      }
      if (!response.ok) throw new Error(data.error);
      if (requestId === explanationRequest.current) setExplanation(data);
    } catch (error) {
      if (requestId === explanationRequest.current)
        setExplanation({
          mode: 'error',
          text:
            error instanceof Error ? error.message : 'The source explanation could not be loaded.',
        });
    } finally {
      if (requestId === explanationRequest.current) setExplaining(false);
    }
  }
  async function openEvaluation() {
    setView('evaluation');
    try {
      const response = await fetch('/api/evaluation');
      if (!response.ok) throw new Error();
      setEvaluation(await response.json());
    } catch {
      setNotice('The scenario suite could not be loaded. Retry from the navigation.');
    }
  }
  async function lockAgent() {
    try {
      const response = await fetch('/api/access', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setAccess((current) => ({ ...current, authorized: false }));
      clearExplanation();
      setNotice('The source agent is locked on this browser.');
    } catch {
      setNotice('The source agent could not be locked. Please retry.');
    }
  }

  return (
    <div className="application">
      <a className="skip-link" href="#main">
        Skip to review
      </a>
      <header className="app-bar">
        <a className="brand" href="/" aria-label="FinePrint home">
          <span className="brand-symbol">
            <FileSearch size={23} strokeWidth={1.75} />
          </span>
          FinePrint<span className="brand-period">.</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="/repository">GitHub review</a>
          <button
            className={view === 'reviews' ? 'active' : ''}
            onClick={() => {
              setCreating(false);
              setView('reviews');
            }}
          >
            My reviews
          </button>
          {(activeReview || isExample) && (
            <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>
              Current review
            </button>
          )}
          {(activeReview || isExample) && (
            <button
              className={view === 'compare' ? 'active' : ''}
              onClick={() => setView('compare')}
            >
              Compare events
            </button>
          )}
          <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>
            Sources
          </button>
        </nav>
        <button
          className="connection-button"
          aria-label="How FinePrint works"
          onClick={() => setView('connection')}
        >
          <CircleHelp size={18} />
          <span>Help & privacy</span>
        </button>
      </header>

      <main id="main" className="main-content">
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        )}
        {reviews.storageError && (
          <div className="error-banner storage-warning" role="alert">
            <CircleAlert size={18} />
            <span>{reviews.storageError}</span>
            <button
              onClick={() =>
                downloadText(
                  reviews.recoveryData ?? exportWorkspace(reviews.workspace),
                  reviews.recoveryData
                    ? 'fineprint-preserved-data.json'
                    : 'fineprint-unsaved-reviews.json',
                )
              }
            >
              {reviews.recoveryData ? 'Download preserved data' : 'Download backup'}
            </button>
            <button onClick={() => window.location.reload()}>Reload saved copy</button>
          </div>
        )}
        {!hydrated && (
          <div className="workspace-loading" role="status">
            Opening your reviews…
          </div>
        )}
        {view === 'reviews' && hydrated && (
          <ReviewLibrary
            packs={catalog.packs}
            workspace={reviews.workspace}
            ready={reviews.ready}
            startCreating={creating}
            savedCount={saved.length}
            onCreate={createReview}
            onOpen={openReview}
            onArchive={reviews.archive}
            onRemoveArchived={reviews.removeArchived}
            onImport={(raw) => {
              const result = importWorkspace(raw, reviews.workspace);
              reviews.setWorkspace(result.workspace);
              setNotice(
                result.imported
                  ? `${result.imported} ${result.imported === 1 ? 'review' : 'reviews'} imported. Recheck against the current rules.`
                  : 'Those reviews are already on this device.',
              );
            }}
            onExample={() => loadExample(1)}
            onSnapshots={() => setView('saved')}
            onSources={() => setView('sources')}
          />
        )}
        {view === 'compare' && hydrated && (
          <EventComparison dossier={dossier} packs={catalog.packs} onSave={createReview} />
        )}
        {view === 'review' && hydrated && (
          <>
            <div className="page-heading">
              <div>
                <h1>{isExample ? 'Sample review' : dossier.name || 'Untitled review'}</h1>
                <p>
                  {isExample
                    ? 'Illustrative facts. Start your own review to check your submission.'
                    : 'Your facts, the applicable rules, and what to do next.'}
                </p>
              </div>
              <a className="event-selector" href={event.url} rel="noreferrer">
                <span className="event-mark">{event.mark}</span>
                <span>
                  <strong>{event.shortTitle}</strong>
                  <small>
                    {eventPhase(sourcePack)} · closes{' '}
                    {new Date(sourcePack.deadline).toLocaleString()}
                  </small>
                </span>
                <ExternalLink size={15} />
              </a>
            </div>

            <div className="review-work-actions">
              <span className={reviews.storageError ? 'save-state failed' : 'save-state'}>
                {isExample
                  ? 'Sample · not saved as your work'
                  : reviews.storageError
                    ? 'Changes are not saved'
                    : 'Autosave on this device'}
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setCreating(true);
                  setView('reviews');
                }}
              >
                <Plus size={15} /> New review
              </button>
            </div>
            {isExample && (
              <div className="example-notice">
                <span>This is a sample. None of these facts describe your project.</span>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setCreating(true);
                    setView('reviews');
                  }}
                >
                  Start my own review <ArrowRight size={15} />
                </button>
              </div>
            )}
            <div className="rule-version-status">
              <div>
                <strong>
                  {catalog.busy
                    ? 'Checking rule versions…'
                    : rulesChanged
                      ? 'A newer rule pack needs your attention.'
                      : 'Curated source versions'}
                </strong>
                <p>
                  {catalog.error ||
                    (catalog.checkedAt
                      ? `Versions checked ${new Date(catalog.checkedAt).toLocaleString()}. ${catalog.mode === 'sanity' ? 'Read from Sanity.' : 'Local snapshots.'}`
                      : 'Current versions have not been checked.')}
                </p>
                <small>
                  Refresh checks FinePrint’s published packs, not organizer websites. Sources were
                  captured{' '}
                  {sourcePack.sources
                    .map((source) => source.capturedAt)
                    .sort()
                    .at(-1)}
                  .
                </small>
                {impact && rulesChanged && (
                  <>
                    <p>
                      Saved {impact.from} → current {impact.to}. {impact.changes.length} affected
                      checks.
                    </p>
                    <ul>
                      {impact.changes.map((change) => (
                        <li key={change.id}>
                          <strong>{change.title}</strong> · {change.kind}. {change.detail}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <button
                className="text-button"
                disabled={catalog.busy}
                onClick={() => void catalog.refresh()}
              >
                Refresh rule versions
              </button>
              {rulesChanged && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void runCheck(dossier)}
                >
                  Recheck updated rules <ArrowRight size={15} />
                </button>
              )}
            </div>
            <details
              className="assistant-drawer"
              open={assistantOpen}
              onToggle={(event) => setAssistantOpen(event.currentTarget.open)}
            >
              <summary>
                <MessageSquareText size={19} />
                <span>
                  Ask a question about the rules
                  <small>Optional AI help with source citations</small>
                </span>
                <ChevronDown size={18} />
              </summary>
              <AskFinePrint
                key={reviews.workspace.activeId ?? 'sample'}
                dossier={dossier}
                initialQuestion={isExample ? '' : activeReview?.question}
                initialResult={isExample ? null : (activeReview?.answer as AskResponse | null)}
                onRemember={(question, answer) => {
                  if (activeReview && !isExample)
                    rememberReview(activeReview.id, { question, answer });
                }}
                onManualReview={() => {
                  setAssistantOpen(false);
                  jumpToFact(next?.field ?? 'origin');
                }}
                onSources={() => setView('sources')}
                onApply={applyAnswer}
              />
            </details>
            <div className="desk-toolbar">
              {isExample ? (
                <div className="examples">
                  <span>Sample reviews</span>
                  {examples.map((example, index) => (
                    <button key={example.id} onClick={() => loadExample(index)} disabled={busy}>
                      {example.name}
                      <ArrowUpRightSmall />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="review-checked-at">
                  {report
                    ? `Last checked ${new Date(report.checkedAt).toLocaleString()}`
                    : 'Your first check is being prepared.'}
                </p>
              )}
              <div className="toolbar-actions">
                <button
                  onClick={() => report && downloadReport(report)}
                  disabled={!report || busy || dirty || rulesChanged}
                >
                  <ArrowDownToLine size={15} /> Download report
                </button>
              </div>
            </div>
            {report && !dirty && !rulesChanged && next && (
              <div className="next-fact" aria-label="Next step">
                <div>
                  <strong>Next: {next.title.replace(/^GIBC: /, '').toLowerCase()}</strong>
                  <p>{next.question}</p>
                </div>
                <button className="secondary-button" onClick={() => jumpToFact(next.field)}>
                  Add this fact <ArrowRight size={16} />
                </button>
              </div>
            )}
            {report && !dirty && !rulesChanged && !next && (
              <div className="next-fact">
                <div>
                  <strong>
                    {report.counts.blocked
                      ? 'Review your blockers before submitting.'
                      : report.counts.unclear
                        ? 'Confirm the unresolved rules with the organizer.'
                        : 'Your stated facts have been checked.'}
                  </strong>
                  <p>Open a finding to see its official source and next step.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="error-banner" role="alert">
                <CircleAlert size={18} />
                <span>{error}</span>
                {dossierSchema.safeParse(dossier).success && (
                  <>
                    <button onClick={() => void runCheck(dossier)}>Retry</button>
                    <button onClick={() => void runCheck(dossier, true, true)}>
                      Use saved rules · {savedPacks[dossier.eventId].updatedAt.slice(0, 10)}
                    </button>
                  </>
                )}
              </div>
            )}
            {report?.sourceMode === 'snapshot' && (
              <div className="warning-banner">
                <Clock3 size={17} />
                Using saved rule pack {report.packVersion}. Recheck when connected to refresh the
                source connection.
              </div>
            )}
            {report?.sourceHealth === 'aging-snapshot' && (
              <div className="warning-banner">
                <Clock3 size={17} />
                The source snapshot is older than seven days. Check the official pages for changes
                before relying on this report.
              </div>
            )}
            <div className="mobile-pane-tabs" role="tablist" aria-label="Review panes">
              {(['facts', 'findings', 'sources'] as Pane[]).map((p) => (
                <button
                  role="tab"
                  aria-selected={pane === p}
                  key={p}
                  className={pane === p ? 'active' : ''}
                  onClick={() => setPane(p)}
                >
                  {p === 'facts'
                    ? 'Project facts'
                    : p === 'findings'
                      ? 'Findings'
                      : 'Rule & sources'}
                </button>
              ))}
            </div>
            <div className="workbench" data-pane={pane}>
              <aside ref={factsRef} className="facts-pane" aria-label="Project facts">
                <div className="pane-header">
                  <h2>Project facts</h2>
                  <SlidersHorizontal size={17} />
                </div>
                <div className="fact-form">
                  <div className="dossier-type">
                    {isExample ? (
                      <>
                        <span className="small-dot" />
                        Illustrative dossier
                      </>
                    ) : (
                      <>
                        <span className="small-dot" />
                        Your declared facts
                      </>
                    )}
                  </div>
                  <label className="field project-name" data-field="name">
                    <span>Project name</span>
                    <input
                      value={dossier.name}
                      onChange={(e) => update('name', e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <label className="field" data-field="track">
                    <span>Target path</span>
                    <select value={dossier.track} onChange={(e) => update('track', e.target.value)}>
                      {event.tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {dossier.eventId === 'sanity-2026' ? (
                    <>
                      <details className="fact-section" open>
                        <summary>
                          Project history
                          <ChevronDown size={15} />
                        </summary>
                        <label className="field" data-field="origin">
                          <span>What existed before the event?</span>
                          <select
                            value={dossier.origin ?? 'unknown'}
                            onChange={(e) =>
                              update('origin', e.target.value === 'unknown' ? null : e.target.value)
                            }
                          >
                            <option value="unknown">Not sure yet</option>
                            <option value="new">Nothing · a new entry</option>
                            <option value="components">Components I’m reusing</option>
                            <option value="existing">The application itself</option>
                          </select>
                        </label>
                        <label className="field" data-field="startedAt">
                          <span>Entry development began</span>
                          <input
                            type="text"
                            placeholder="YYYY-MM-DD"
                            value={dossier.startedAt ?? ''}
                            onChange={(e) => update('startedAt', e.target.value || null)}
                          />
                          <small>Use an ISO date. On the opening day, add the time and zone.</small>
                        </label>
                        {dossier.origin && dossier.origin !== 'new' && (
                          <>
                            <TriSelect
                              field="priorWorkCredited"
                              dossier={dossier}
                              onChange={update}
                            />
                            <TriSelect
                              field="substantialNewWork"
                              dossier={dossier}
                              onChange={update}
                            />
                          </>
                        )}
                      </details>
                      <details className="fact-section">
                        <summary>
                          Team & participation
                          <ChevronDown size={15} />
                        </summary>
                        <label className="field" data-field="teamSize">
                          <span>Team size</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={dossier.teamSize ?? ''}
                            onChange={(e) =>
                              update('teamSize', e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </label>
                        <TriSelect field="adultTeam" dossier={dossier} onChange={update} />
                        <TriSelect
                          field="eligibleResidency"
                          dossier={dossier}
                          onChange={update}
                          help="Read the general rules for the listed jurisdictions and other restrictions."
                        />
                        <TriSelect field="devMembership" dossier={dossier} onChange={update} />
                        <TriSelect
                          field="excludedAffiliation"
                          dossier={dossier}
                          onChange={update}
                        />
                      </details>
                      <details className="fact-section">
                        <summary>
                          Sanity & build
                          <ChevronDown size={15} />
                        </summary>
                        {dossier.track !== 'path-two' && (
                          <>
                            <TriSelect field="usesContext" dossier={dossier} onChange={update} />
                            <TriSelect
                              field="usesKnowledgeBase"
                              dossier={dossier}
                              onChange={update}
                            />
                          </>
                        )}
                        {dossier.track !== 'path-one' && (
                          <>
                            <TriSelect field="usesSanity" dossier={dossier} onChange={update} />
                            <TriSelect field="aiBuilt" dossier={dossier} onChange={update} />
                            <TriSelect
                              field="supportedFrontend"
                              dossier={dossier}
                              onChange={update}
                            />
                          </>
                        )}
                      </details>
                      <details className="fact-section">
                        <summary>
                          Entries & prizes
                          <ChevronDown size={15} />
                        </summary>
                        <label className="field" data-field="entriesPerPath">
                          <span>Entries in the same path</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={dossier.entriesPerPath ?? ''}
                            onChange={(e) =>
                              update(
                                'entriesPerPath',
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                        </label>
                        <TriSelect field="englishSubmission" dossier={dossier} onChange={update} />
                        <TriSelect
                          field="seeksMultiplePrizes"
                          dossier={dossier}
                          onChange={update}
                        />
                        {dossier.track === 'both' && (
                          <TriSelect field="separatePosts" dossier={dossier} onChange={update} />
                        )}
                      </details>
                      <details className="fact-section">
                        <summary>
                          Submission artifacts
                          <ChevronDown size={15} />
                        </summary>
                        <TriSelect field="requiresLogin" dossier={dossier} onChange={update} />
                        {dossier.requiresLogin !== false && (
                          <TriSelect field="judgeAccess" dossier={dossier} onChange={update} />
                        )}
                        <label className="field" data-field="projectIdentifier">
                          <span>Sanity project ID or dataset URL</span>
                          <input
                            placeholder="Project ID or public URL"
                            value={dossier.projectIdentifier ?? ''}
                            onChange={(e) => update('projectIdentifier', e.target.value)}
                          />
                        </label>
                        <TriSelect field="publishedPost" dossier={dossier} onChange={update} />
                        <TriSelect field="hasChallengeTag" dossier={dossier} onChange={update} />
                      </details>
                    </>
                  ) : (
                    <GibcFacts dossier={dossier} update={update} />
                  )}
                  <details className="fact-section">
                    <summary>
                      Evidence & context
                      <ChevronDown size={15} />
                    </summary>
                    <label className="field" data-field="evidenceNote">
                      <span>What supports these facts?</span>
                      <textarea
                        rows={5}
                        value={dossier.evidenceNote}
                        onChange={(e) => update('evidenceNote', e.target.value)}
                        maxLength={2000}
                      />
                      <small>
                        Notes are kept as context. They do not override structured facts or verify a
                        claim.
                      </small>
                    </label>
                  </details>
                </div>
                <div className="check-area">
                  {dirty && (
                    <p className="unsaved-indicator">
                      Facts changed. Check again to update the report.
                    </p>
                  )}
                  <button
                    className="primary-button"
                    onClick={() => void runCheck(dossier)}
                    disabled={busy}
                  >
                    {busy ? <LoaderCircle size={17} className="spin" /> : <FileSearch size={17} />}{' '}
                    {busy ? 'Checking requirements…' : 'Check rules'}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                </div>
              </aside>

              <section className="findings-pane" aria-label="Eligibility findings">
                <div className="pane-header">
                  <h2>Your review</h2>
                  {report && <span className="check-count">{report.findings.length} checks</span>}
                </div>
                {!report ? (
                  <div className="empty-review">
                    <FileSearch size={38} strokeWidth={1.25} />
                    <h3>
                      {busy
                        ? 'Reading the applicable requirements…'
                        : 'A clearer answer starts with your facts.'}
                    </h3>
                    <p>
                      {busy
                        ? 'The rule pack and your dossier are being checked.'
                        : 'Add what you know, then check eligibility. You can leave anything uncertain unanswered.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="review-summary">
                      <span
                        className={`summary-symbol ${report.findings.some((f) => f.status === 'blocked' && ['entry', 'path'].includes(f.rule.scope)) ? 'blocked' : ''}`}
                      >
                        <ShieldQuestion size={25} strokeWidth={1.5} />
                      </span>
                      <div>
                        <h3>{report.summary}</h3>
                        <p>
                          Based on the facts you supplied ·{' '}
                          <strong>{formatFact(report.dossier.track)}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="summary-counts">
                      <span>
                        <i className="count-dot supported" />
                        {report.counts.supported} supported
                      </span>
                      <span>
                        <i className="count-dot blocked" />
                        {report.counts.blocked} blocked
                      </span>
                      <span>
                        <i className="count-dot missing" />
                        {report.counts.missing + report.counts.unclear} need attention
                      </span>
                    </div>
                    {baseline && (
                      <button
                        className={`compare-strip ${comparing ? 'on' : ''}`}
                        onClick={() => setComparing(!comparing)}
                        aria-pressed={comparing}
                      >
                        <GitCompareArrows size={16} />
                        <span>
                          {comparing
                            ? `${changed.length} checks changed since the previous snapshot`
                            : 'Compare with previous snapshot'}
                        </span>
                        <span className="compare-toggle">
                          <span />
                        </span>
                      </button>
                    )}
                    {dirty && (
                      <div className="stale-report">
                        <Clock3 size={15} />
                        This report uses your previous facts.
                      </div>
                    )}
                    <div className="finding-controls">
                      <div className="segmented">
                        <button
                          className={scope === 'eligibility' ? 'active' : ''}
                          onClick={() => setScope('eligibility')}
                        >
                          Eligibility
                        </button>
                        <button
                          className={scope === 'submission' ? 'active' : ''}
                          onClick={() => setScope('submission')}
                        >
                          Submission
                        </button>
                        <button
                          className={scope === 'all' ? 'active' : ''}
                          onClick={() => setScope('all')}
                        >
                          All
                        </button>
                      </div>
                      <select
                        aria-label="Filter findings"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as typeof filter)}
                      >
                        <option value="all">All results</option>
                        <option value="attention">Needs attention</option>
                        <option value="supported">Supported</option>
                      </select>
                    </div>
                    <div className="finding-list">
                      {groups.length ? (
                        groups.map((group) => (
                          <section className="finding-group" key={group.key}>
                            <h3>
                              {group.label}
                              <span>{group.findings.length}</span>
                            </h3>
                            {group.findings.map((finding) => (
                              <button
                                key={finding.rule.id}
                                className={`finding-row ${selected === finding.rule.id ? 'selected' : ''} ${comparing && changed.includes(finding.rule.id) ? 'changed' : ''}`}
                                onClick={() => selectFinding(finding)}
                                aria-pressed={selected === finding.rule.id}
                              >
                                <StatusIcon status={finding.status} />
                                <span className="finding-copy">
                                  <span className="finding-title">
                                    {finding.rule.title}
                                    {comparing && changed.includes(finding.rule.id) && (
                                      <span className="changed-label">Changed</span>
                                    )}
                                  </span>
                                  <span className="finding-subtitle">{finding.rule.summary}</span>
                                </span>
                                <StatusTag status={finding.status} />
                                <ArrowRight size={14} className="row-arrow" />
                              </button>
                            ))}
                          </section>
                        ))
                      ) : (
                        <div className="empty-filter">
                          <Search size={24} />
                          <p>No findings match this filter.</p>
                          <button
                            onClick={() => {
                              setFilter('all');
                              setScope('all');
                            }}
                          >
                            Show all checks
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="review-footnote">
                      <BookOpen size={14} />
                      <p>
                        Selected requirements, not a complete eligibility certification. Sources
                        establish rules; your facts still need evidence.
                      </p>
                    </div>
                  </>
                )}
              </section>

              <aside className="source-pane" aria-label="Selected rule and sources">
                <div className="pane-header">
                  <h2>Behind the finding</h2>
                  <BookOpen size={17} />
                </div>
                {activeFinding ? (
                  <div className="source-content">
                    <div className="rule-identity">
                      <StatusTag status={activeFinding.status} />
                    </div>
                    <h3>{activeFinding.rule.title}</h3>
                    <p className="selected-reason">{activeFinding.reason}</p>
                    {activeFinding.facts.length > 0 && (
                      <div className="observed-facts">
                        <h4>What you told us</h4>
                        {activeFinding.facts.map((f) => (
                          <div key={f.key}>
                            <span>{factLabels[f.key as FactKey] ?? f.key}</span>
                            <strong>{formatFact(f.value)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rule-reading">
                      <h4>How the rule applies</h4>
                      <p>{activeFinding.rule.rationale}</p>
                    </div>
                    <div className="source-citations">
                      <h4>
                        {activeFinding.rule.sources.length > 1
                          ? 'Read the sources together'
                          : 'Official source'}
                      </h4>
                      {activeFinding.rule.sources.map((id) => {
                        const source = report!.sources.find((s) => s.id === id);
                        if (!source) return null;
                        return (
                          <article className="source-citation" key={id}>
                            <a href={source.url} rel="noreferrer">
                              <span className="source-letter">
                                {id.startsWith('gibc-')
                                  ? 'G'
                                  : id === 'general'
                                    ? 'G'
                                    : id === 'faq'
                                      ? 'F'
                                      : 'C'}
                              </span>
                              {source.title}
                              <ExternalLink size={13} />
                            </a>
                            {(activeFinding.rule.id === 'entry-limit' && id !== 'general') ||
                            (['origin', 'start'].includes(activeFinding.rule.id) &&
                              id === 'general') ? (
                              <blockquote>“{source.quote}”</blockquote>
                            ) : (
                              <p>{source.summary}</p>
                            )}
                            <small>Captured {source.capturedAt}</small>
                          </article>
                        );
                      })}
                    </div>
                    {(activeFinding.status === 'unclear' ||
                      (activeFinding.rule.id === 'origin' &&
                        report?.dossier.origin === 'existing')) && (
                      <div className="organizer-question">
                        <h4>
                          <CircleHelp size={15} />
                          Question for the organizer
                        </h4>
                        <p>
                          {activeFinding.status === 'unclear'
                            ? activeFinding.rule.question
                            : 'My application existed before the event. What new work, if any, would make this an eligible entry under the development-window requirement?'}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                activeFinding.status === 'unclear'
                                  ? activeFinding.rule.question
                                  : 'My application existed before the event. What new work, if any, would make this an eligible entry under the development-window requirement?',
                              );
                              setNotice('Question copied. You can send it to the organizer.');
                            } catch {
                              setNotice(
                                'Clipboard unavailable. Select and copy the question above.',
                              );
                            }
                          }}
                        >
                          Copy question
                          <Files size={13} />
                        </button>
                      </div>
                    )}
                    <button
                      className="explain-button"
                      onClick={() => void explainFinding()}
                      disabled={explaining || dirty}
                    >
                      {explaining ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Sparkles size={15} />
                      )}{' '}
                      {explaining
                        ? 'Reading source context…'
                        : access.required && access.available && !access.authorized
                          ? 'Unlock source agent'
                          : connection.context && connection.model
                            ? 'Ask the source agent'
                            : 'Explain this finding'}
                      <ArrowRight size={14} />
                    </button>
                    {showAccess && (
                      <AgentAccessForm
                        onAuthorized={() => {
                          setAccess((current) => ({ ...current, authorized: true }));
                          setShowAccess(false);
                          setNotice(
                            'Source agent unlocked for two hours. Choose a finding, then ask for its explanation.',
                          );
                        }}
                        onCancel={() => setShowAccess(false)}
                      />
                    )}
                    {explanation && (
                      <div className="explanation" role="status">
                        <span>
                          {explanation.mode === 'live'
                            ? 'Sanity Context agent'
                            : explanation.mode === 'error'
                              ? 'Connection issue'
                              : 'From the curated rule pack'}
                        </span>
                        <p>{explanation.text}</p>
                        {Boolean(explanation.paths?.length) && (
                          <details className="agent-citations">
                            <summary>
                              {explanation.paths?.length} cited Knowledge Base entries
                            </summary>
                            <ul>
                              {explanation.paths?.map((path) => (
                                <li key={path}>
                                  <code>{path}</code>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {explanation.trace && <AgentTrace steps={explanation.trace} />}
                      </div>
                    )}
                    <p className="curation-note">
                      {connection.context && connection.model && (
                        <>The source agent shares only this finding’s facts with Modal. </>
                      )}
                      AI-assisted curation. An interpretation here is not an organizer approval.
                    </p>
                  </div>
                ) : (
                  <div className="source-placeholder">
                    <BookOpen size={30} strokeWidth={1.25} />
                    <p>Select a finding to see its facts and official sources.</p>
                  </div>
                )}
              </aside>
            </div>
            <footer className="desk-footer">
              <span>
                <span className="small-dot" />
                Source pack {report?.packVersion ?? sourcePack.version}
              </span>
              <span>Saved on this device · download a backup to keep your work</span>
              <a href={event.url} rel="noreferrer">
                Official challenge
                <ExternalLink size={12} />
              </a>
            </footer>
          </>
        )}

        {view === 'sources' && (
          <div className="secondary-view">
            <PageIntro
              title="Every finding has a source."
              description="Official sources for each curated event. Capture dates describe when the pages were reviewed; they are not live monitoring."
              onBack={() => setView(activeReview || isExample ? 'review' : 'reviews')}
            />
            <div className="source-library">
              {eventCatalog
                .flatMap((event) =>
                  (catalog.packs[event.id] ?? savedPacks[event.id]).sources.map((source) => ({
                    ...source,
                    eventTitle: event.shortTitle,
                  })),
                )
                .map((source) => (
                  <article key={source.id}>
                    <div className="library-source-title">
                      <BookOpen size={21} />
                      <div>
                        <h2>{source.title}</h2>
                        <span>
                          {source.eventTitle} · {source.publisher}
                        </span>
                      </div>
                      <a href={source.url} rel="noreferrer" aria-label={`Open ${source.title}`}>
                        <ExternalLink size={19} />
                      </a>
                    </div>
                    <blockquote>“{source.quote}”</blockquote>
                    <p>{source.summary}</p>
                    <dl>
                      <div>
                        <dt>Authority</dt>
                        <dd>{source.authority}</dd>
                      </div>
                      <div>
                        <dt>Version</dt>
                        <dd>{source.version}</dd>
                      </div>
                      <div>
                        <dt>Captured</dt>
                        <dd>{source.capturedAt}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
            </div>
            <div className="info-note">
              <ShieldQuestion size={22} />
              <div>
                <h3>Source agreement matters.</h3>
                <p>
                  Sanity’s FAQ and contest rules disagree about the number of entries. FinePrint
                  preserves both claims. General rules also state an explicit precedence
                  relationship; the app does not invent one for every other source.
                </p>
              </div>
            </div>
          </div>
        )}

        {view === 'saved' && (
          <div className="secondary-view">
            <PageIntro
              title="Keep the decision trail."
              description="Saved snapshots belong to this browser. Restore one to check it again against the current rule pack."
              onBack={() => setView(activeReview || isExample ? 'review' : 'reviews')}
            />
            {saved.length ? (
              <div className="saved-list">
                {saved.map((item) => (
                  <article key={item.id}>
                    <span className="saved-icon">
                      <Files size={23} />
                    </span>
                    <div>
                      <h2>{item.name}</h2>
                      <p>{item.report.summary}</p>
                      <small>
                        {new Date(item.savedAt).toLocaleString()} · {item.report.packVersion}
                      </small>
                    </div>
                    <button className="secondary-button" onClick={() => restoreCase(item)}>
                      Restore & recheck
                      <ArrowRight size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Export ${item.name}`}
                      onClick={() => downloadReport(item.report)}
                    >
                      <ArrowDownToLine size={17} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Files size={42} strokeWidth={1.2} />
                <h2>Your first snapshot starts here.</h2>
                <p>
                  Run a review, then save it. You’ll be able to compare the result after your
                  project or the rules change.
                </p>
                <button className="primary-button" onClick={() => setView('review')}>
                  Open review desk
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'evaluation' && (
          <div className="secondary-view">
            <PageIntro
              title="Test the difficult cases."
              description="Authored regression scenarios check uncertainty, rule scope, and boundary conditions. These are software checks, not measured real-world accuracy."
              onBack={() => setView(activeReview || isExample ? 'review' : 'reviews')}
            />
            {evaluation ? (
              <>
                <div className="evaluation-summary">
                  <CheckCheck size={28} />
                  <div>
                    <h2>
                      {evaluation.passed} of {evaluation.total} scenarios match their expected
                      finding.
                    </h2>
                    <p>
                      Fixed rule pack · fixed evaluation clock · expected labels authored during
                      development
                    </p>
                  </div>
                  <span className="status-tag supported">
                    {evaluation.passed === evaluation.total ? 'Passing' : 'Needs review'}
                  </span>
                </div>
                <div className="evaluation-table">
                  <div className="evaluation-row evaluation-header">
                    <span>Scenario</span>
                    <span>Expected</span>
                    <span>Observed</span>
                  </div>
                  {evaluation.cases.map((item) => (
                    <div className="evaluation-row" key={item.name}>
                      <span>
                        <StatusIcon status={item.passed ? 'supported' : 'blocked'} />
                        {item.name}
                      </span>
                      <span>{item.expected}</span>
                      <span>{item.actual}</span>
                    </div>
                  ))}
                </div>
                {evaluation.baseline && (
                  <div className="info-note">
                    <GitCompareArrows size={22} />
                    <div>
                      <h3>
                        Recorded model baseline: {evaluation.baseline.passed}/
                        {evaluation.baseline.total} labels matched
                      </h3>
                      <p>
                        Modal · {evaluation.baseline.model} ·{' '}
                        {new Date(evaluation.baseline.runAt).toLocaleDateString()}. Every batch
                        received all nine Sanity Knowledge Base entries, without the typed
                        conditions or expected answers. Retrieval selection was held constant.
                      </p>
                      <ul>
                        {evaluation.baseline.mismatches.map((item) => (
                          <li key={item.name}>
                            {item.name}: expected {item.expected}; model returned {item.status}.
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {evaluation.multiEvent && (
                  <div className="info-note">
                    <GitCompareArrows size={22} />
                    <div>
                      <h3>Recorded comparison across two events</h3>
                      <p>
                        Four questions ran against Sanity Context and Modal on{' '}
                        {new Date(evaluation.multiEvent.runAt).toLocaleDateString()}. The typed
                        checks matched all four authored labels. The model agreed on three; its date
                        interpretation disagreed on one.
                      </p>
                      <ul>
                        {evaluation.multiEvent.results.map((item) => (
                          <li key={`${item.eventId}-${item.ruleId}`}>
                            {item.eventId === 'sanity-2026' ? 'Sanity' : 'GIBC'} ·{' '}
                            {item.ruleId.endsWith('team') ? 'Five-person team' : 'August 23 start'}:
                            check {item.actual}, model {item.agentInterpretation ?? 'unavailable'}.{' '}
                            {item.citedRelevantRule ? 'Relevant source cited' : 'Source missing'} ·{' '}
                            {(item.elapsedMs / 1000).toFixed(1)}s.
                          </li>
                        ))}
                      </ul>
                      <p>{evaluation.multiEvent.limitations}</p>
                      <a href="https://github.com/himanshu748/fineprint/blob/main/evaluation/multi-event-context.json">
                        Read the questions and actual tool traces ↗
                      </a>
                    </div>
                  </div>
                )}
                <div className="info-note">
                  <CircleHelp size={22} />
                  <div>
                    <h3>What this establishes</h3>
                    <p>
                      The engine matches the authored fixtures. The fixtures and Knowledge Base
                      share the same curated source pack, so this is not independent eligibility
                      accuracy or a controlled retrieval-quality comparison.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <LoaderCircle className="spin" />
                <p>Running the scenario suite…</p>
              </div>
            )}
          </div>
        )}

        {view === 'connection' && (
          <div className="secondary-view product-help">
            <PageIntro
              title="How FinePrint works"
              description="Check the rules, keep the evidence, and know what still needs an answer."
              onBack={() => setView(activeReview || isExample ? 'review' : 'reviews')}
            />
            <section>
              <h2>Which events can I check?</h2>
              <p>
                FinePrint covers 19 selected requirements of the DEV × Sanity Challenge and 18 for
                GIBC V2’s Open Invention track. GIBC’s LLM and Med/Finance tracks are outside
                coverage. Open a review, then Compare events to see the same project against both
                packs.
              </p>
              <button className="text-button" onClick={() => setView('sources')}>
                Read the official sources <ArrowRight size={15} />
              </button>
            </section>
            <section>
              <h2>What does a result mean?</h2>
              <p>
                Supported means your stated facts meet a particular check. Blocked identifies a
                mismatch. Missing fact means more information is needed. Rules unclear preserves a
                source conflict for the organizer to resolve. A report is not approval to enter or
                win a prize.
              </p>
            </section>
            <section>
              <h2>Where is my work saved?</h2>
              <p>
                Your reviews, questions and answers autosave in this browser. They are not uploaded
                to the public rules dataset or synced to an account. Anyone using this browser
                profile can open them. A backup downloads your project facts; a report downloads the
                findings. Clearing browser data removes local reviews.
              </p>
              <button className="text-button" onClick={() => setView('reviews')}>
                Manage reviews and backups <ArrowRight size={15} />
              </button>
            </section>
            <section>
              <h2>Do I need to use AI?</h2>
              <p>
                No. Add facts and use Check rules as often as you need. Optional questions and
                explanations share an allowance of five requests per ten minutes in a regional pool.
                If it is busy, continue with the form. The AI service receives your question and any
                facts you explicitly include; avoid putting passwords or private access codes in a
                question.
              </p>
            </section>
            <section>
              <h2>How current are the rules?</h2>
              <p>
                Each source has its own capture date. Refresh rule versions reads FinePrint’s
                curated packs from Sanity and flags saved findings affected by changed requirements
                or linked sources. It does not crawl organizer websites. Check the official page
                before submitting. A saved report shows when your facts were checked. If a
                connection fails, you can explicitly choose the dated saved rules.
              </p>
            </section>
            <details className="product-transparency">
              <summary>Technology and verification</summary>
              <p>
                Sanity Content Lake holds the curated requirements. Sanity Context supplies the
                Knowledge Base. Modal runs the model that reads sources and proposes facts. The
                typed checker computes the report; model and check disagreements remain visible.
              </p>
              <p>
                Provider setup:{' '}
                {connection.rules && connection.context && connection.model
                  ? 'configured'
                  : 'partially configured'}
                . A completed source read is the evidence of a live connection.
              </p>
              <button className="text-button" onClick={() => void openEvaluation()}>
                Inspect the authored test cases <ArrowRight size={15} />
              </button>
              <a href="https://github.com/himanshu748/fineprint" target="_blank" rel="noreferrer">
                View the source code <ExternalLink size={14} />
              </a>
            </details>
            {access.required && access.authorized && (
              <button className="secondary-button" onClick={() => void lockAgent()}>
                Lock AI access on this browser
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ArrowUpRightSmall() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 9 9 3M3 3h6v6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PageIntro({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="secondary-heading">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to review
      </button>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
