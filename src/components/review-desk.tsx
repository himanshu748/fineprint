'use client';

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
  PanelLeftClose,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldQuestion,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  dossierSchema,
  savedCaseSchema,
  factLabels,
  type Dossier,
  type FactKey,
  type Finding,
  type Report,
  type Scope,
  type Status,
} from '@/lib/model';
import { blankDossier, examples, rulePack } from '@/lib/rules';
import { changedFindings, formatFact, reportMarkdown } from '@/lib/engine';
import { AgentAccessForm } from './agent-access-form';
import { AskFinePrint } from './ask-fineprint';
import { AgentTrace } from './agent-trace';
import type { TraceStep } from '@/lib/agent-trace';

type SavedCase = { id: string; name: string; savedAt: string; dossier: Dossier; report: Report };
type View = 'review' | 'sources' | 'saved' | 'evaluation' | 'connection';
type Pane = 'facts' | 'findings' | 'sources';
const statusLabels: Record<Status, string> = {
  supported: 'Supported',
  blocked: 'Blocked',
  missing: 'Missing fact',
  unclear: 'Rules unclear',
  'not-applicable': 'Not applicable',
};
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
function StatusTag({ status }: { status: Status }) {
  return <span className={`status-tag ${status}`}>{statusLabels[status]}</span>;
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
    <label className="field">
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
  const [view, setView] = useState<View>('review');
  const [pane, setPane] = useState<Pane>('findings');
  const [dossier, setDossier] = useState<Dossier>(examples[0].dossier);
  const [report, setReport] = useState<Report | null>(null);
  const [baseline, setBaseline] = useState<Report | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState('origin');
  const [filter, setFilter] = useState<'all' | 'attention' | 'supported'>('all');
  const [scope, setScope] = useState<'all' | 'eligibility' | 'submission'>('eligibility');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isExample, setIsExample] = useState(true);
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

  async function runCheck(facts: Dossier, remember = true) {
    setError('');
    if (!dossierSchema.safeParse(facts).success) {
      setError('Add a project name and valid project facts before checking.');
      return;
    }
    const requestId = ++checkRequest.current;
    setBusy(true);
    clearExplanation();
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facts),
      });
      const data = await response.json();
      if (requestId !== checkRequest.current) return;
      if (!response.ok) throw new Error(data.error || 'The check did not complete. Please retry.');
      if (remember && report) setBaseline(report);
      setReport(data);
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
    void runCheck(examples[0].dossier, false);
    void fetch('/api/connection')
      .then((res) => res.json())
      .then(setConnection)
      .catch(() => {});
    void fetch('/api/access')
      .then((res) => res.json())
      .then(setAccess)
      .catch(() => {});
    // A first review is requested once; later reviews require an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setIsExample(false);
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
    setIsExample(true);
    setView('review');
    setSelected(index === 2 ? 'entry-limit' : 'origin');
    void runCheck(facts);
  }
  function saveCase() {
    if (!report || dirty) {
      setNotice('Check the updated facts before saving a snapshot.');
      return;
    }
    const next = [
      {
        id: crypto.randomUUID(),
        name: report.dossier.name,
        savedAt: new Date().toISOString(),
        dossier: report.dossier,
        report,
      },
      ...saved,
    ].slice(0, 12);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
      setNotice('Snapshot saved on this device.');
    } catch {
      setNotice('Browser storage is full or unavailable. Export the report to keep a copy.');
    }
  }
  function restoreCase(item: SavedCase) {
    setDossier(item.dossier);
    setBaseline(item.report);
    setReport(null);
    setComparing(true);
    setView('review');
    setIsExample(false);
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
          <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>
            Review desk
          </button>
          <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>
            Sources
          </button>
          <button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>
            Saved <span className="nav-count">{saved.length}</span>
          </button>
          <button
            className={view === 'evaluation' ? 'active' : ''}
            onClick={() => void openEvaluation()}
          >
            Evaluation
          </button>
        </nav>
        <button
          className="connection-button"
          aria-label="View source and model connections"
          onClick={() => setView('connection')}
        >
          <span
            className={`connection-dot ${report?.sourceMode === 'sanity' ? 'connected' : ''}`}
          />
          <span>{report?.sourceMode === 'sanity' ? 'Sanity sources' : 'Local source pack'}</span>
          <Settings2 size={15} aria-hidden="true" />
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
        {view === 'review' && (
          <>
            <div className="page-heading">
              <div>
                <h1>Know where your project stands.</h1>
                <p>Check the rules that apply. Understand the answer.</p>
              </div>
              <a
                className="event-selector"
                href="https://dev.to/challenges/sanity-2026-09-16"
                target="_blank"
                rel="noreferrer"
              >
                <span className="event-mark">S</span>
                <span>
                  <strong>Sanity Challenge</strong>
                  <small>Closes Oct 4, 2026 · 11:59 PM PDT</small>
                </span>
                <ExternalLink size={15} />
              </a>
            </div>

            <AskFinePrint
              dossier={dossier}
              onApply={(next) => {
                checkRequest.current++;
                setBusy(false);
                clearExplanation();
                if (report) setBaseline(report);
                setDossier(next.dossier);
                setReport(next);
                setComparing(Boolean(report));
                setIsExample(false);
                setScope('all');
                setPane('findings');
                setSelected(
                  next.findings.find((f) => f.status === 'blocked' || f.status === 'unclear')?.rule
                    .id ?? 'origin',
                );
                setNotice(
                  'Agent facts applied. Review the extracted facts and source interpretations before relying on them.',
                );
              }}
            />
            <div className="desk-toolbar">
              <div className="examples">
                <span>Try a scenario</span>
                {examples.map((example, index) => (
                  <button
                    key={example.id}
                    title={example.description}
                    className={
                      isExample &&
                      dossier.origin === example.dossier.origin &&
                      dossier.entriesPerPath === example.dossier.entriesPerPath
                        ? 'selected'
                        : ''
                    }
                    onClick={() => loadExample(index)}
                    disabled={busy}
                  >
                    {example.name}
                    <ArrowUpRightSmall />
                  </button>
                ))}
              </div>
              <div className="toolbar-actions">
                <button onClick={saveCase} disabled={!report || busy || dirty}>
                  <Save size={15} />
                  Save snapshot
                </button>
                <button
                  onClick={() => report && downloadReport(report)}
                  disabled={!report || busy || dirty}
                >
                  <ArrowDownToLine size={15} />
                  Export report
                </button>
              </div>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <CircleAlert size={18} />
                <span>{error}</span>
                <button onClick={() => void runCheck(dossier)}>Retry</button>
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
              <aside className="facts-pane" aria-label="Project facts">
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
                  <label className="field project-name">
                    <span>Project name</span>
                    <input
                      value={dossier.name}
                      onChange={(e) => update('name', e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <label className="field">
                    <span>Target path</span>
                    <select value={dossier.track} onChange={(e) => update('track', e.target.value)}>
                      <option value="path-one">Path One · AI agent</option>
                      <option value="path-two">Path Two · AI-built app</option>
                      <option value="both">Both paths</option>
                    </select>
                  </label>
                  <details className="fact-section" open>
                    <summary>
                      Project history
                      <ChevronDown size={15} />
                    </summary>
                    <label className="field">
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
                    <label className="field">
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
                        <TriSelect field="priorWorkCredited" dossier={dossier} onChange={update} />
                        <TriSelect field="substantialNewWork" dossier={dossier} onChange={update} />
                      </>
                    )}
                  </details>
                  <details className="fact-section">
                    <summary>
                      Team & participation
                      <ChevronDown size={15} />
                    </summary>
                    <label className="field">
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
                    <TriSelect field="excludedAffiliation" dossier={dossier} onChange={update} />
                  </details>
                  <details className="fact-section">
                    <summary>
                      Sanity & build
                      <ChevronDown size={15} />
                    </summary>
                    {dossier.track !== 'path-two' && (
                      <>
                        <TriSelect field="usesContext" dossier={dossier} onChange={update} />
                        <TriSelect field="usesKnowledgeBase" dossier={dossier} onChange={update} />
                      </>
                    )}
                    {dossier.track !== 'path-one' && (
                      <>
                        <TriSelect field="usesSanity" dossier={dossier} onChange={update} />
                        <TriSelect field="aiBuilt" dossier={dossier} onChange={update} />
                        <TriSelect field="supportedFrontend" dossier={dossier} onChange={update} />
                      </>
                    )}
                  </details>
                  <details className="fact-section">
                    <summary>
                      Entries & prizes
                      <ChevronDown size={15} />
                    </summary>
                    <label className="field">
                      <span>Entries in the same path</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={dossier.entriesPerPath ?? ''}
                        onChange={(e) =>
                          update('entriesPerPath', e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </label>
                    <TriSelect field="englishSubmission" dossier={dossier} onChange={update} />
                    <TriSelect field="seeksMultiplePrizes" dossier={dossier} onChange={update} />
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
                    <label className="field">
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
                  <details className="fact-section">
                    <summary>
                      Evidence & context
                      <ChevronDown size={15} />
                    </summary>
                    <label className="field">
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
                    {busy ? 'Checking requirements…' : 'Check eligibility'}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                  <button
                    className="text-button new-review"
                    onClick={() => {
                      checkRequest.current++;
                      clearExplanation();
                      setDossier({ ...blankDossier });
                      setReport(null);
                      setBaseline(null);
                      setIsExample(false);
                      setPane('facts');
                      setNotice('A blank dossier is ready. Unknown facts will stay unknown.');
                    }}
                    disabled={busy}
                  >
                    <Plus size={14} />
                    Start with my own project
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
                          <strong>
                            {report.dossier.track === 'both'
                              ? 'Both paths'
                              : report.dossier.track === 'path-one'
                                ? 'Path One'
                                : 'Path Two'}
                          </strong>
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
                            <a href={source.url} target="_blank" rel="noreferrer">
                              <span className="source-letter">
                                {id === 'general' ? 'G' : id === 'faq' ? 'F' : 'C'}
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
                Source pack {report?.packVersion ?? rulePack.version}
              </span>
              <span>Private by default · snapshots stay on this device</span>
              <a
                href="https://dev.to/challenges/sanity-2026-09-16"
                target="_blank"
                rel="noreferrer"
              >
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
              description="Three official pages, kept distinct. Contradictions and source authority remain visible."
              onBack={() => setView('review')}
            />
            <div className="source-library">
              {(report?.sources ?? rulePack.sources).map((source) => (
                <article key={source.id}>
                  <div className="library-source-title">
                    <BookOpen size={21} />
                    <div>
                      <h2>{source.title}</h2>
                      <span>{source.publisher}</span>
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${source.title}`}
                    >
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
                  The FAQ and contest rules disagree about the number of entries. FinePrint
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
              onBack={() => setView('review')}
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
              onBack={() => setView('review')}
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
          <div className="secondary-view connection-view">
            <PageIntro
              title="Connect the source agent."
              description="The review desk works with a dated rule snapshot. Sanity supplies the live structured content and Knowledge Base for the agent."
              onBack={() => setView('review')}
            />
            <div className="connection-steps">
              {[
                {
                  title: 'Structured rules',
                  body: 'Load the curated competition, source versions, and linked requirements from Sanity Content Lake.',
                  ready: connection.rules,
                },
                {
                  title: 'Knowledge Base',
                  body: 'Read the reviewed source material through a Sanity Context MCP endpoint in Knowledge Base mode.',
                  ready: connection.context,
                },
                {
                  title: 'Agent model',
                  body: 'The agent selects Knowledge Base entries, extracts quoted facts and calls the rules checker. Source interpretation stays visible alongside the typed result.',
                  ready: connection.model,
                },
              ].map((step) => (
                <article key={step.title}>
                  <StatusIcon status={step.ready ? 'supported' : 'missing'} size={22} />
                  <div>
                    <h2>{step.title}</h2>
                    <p>{step.body}</p>
                  </div>
                  <span className={`status-tag ${step.ready ? 'supported' : 'missing'}`}>
                    {step.ready ? 'Configured' : 'Not configured'}
                  </span>
                </article>
              ))}
            </div>
            <div className="info-note">
              <ShieldQuestion size={22} />
              <div>
                <h3>Configured is not verified.</h3>
                <p>
                  A successful source-agent response is the proof of a live retrieval. If a
                  configured provider fails, the app shows the failure. It never presents a local
                  explanation as a live agent run.
                </p>
              </div>
            </div>
            <div className="connection-help">
              {access.required && access.authorized && (
                <button className="secondary-button" onClick={() => void lockAgent()}>
                  Lock source agent on this browser
                </button>
              )}
              <h2>Server configuration</h2>
              <p>
                The source project includes an environment template, rule-pack JSON Schema and seed
                script, and a connection verifier. Keep tokens on the server. This screen never
                accepts or exposes credentials.
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  void fetch('/api/connection')
                    .then((r) => r.json())
                    .then(setConnection);
                  setNotice(
                    'Configuration refreshed. Run a source explanation to verify the connection.',
                  );
                }}
              >
                <RotateCcw size={16} />
                Refresh configuration
              </button>
            </div>
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
        Review desk
      </button>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
