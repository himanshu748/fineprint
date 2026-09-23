'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, FileSearch, Github, LoaderCircle, Download } from 'lucide-react';
import { rubrics, rubricIdSchema } from '@/lib/rubrics';
import { repositoryReportSchema, type RepositoryReport } from '@/lib/repository-schema';
import { AgentTrace } from './agent-trace';
const storage = 'fineprint.repository-review.v1';
const labels = {
  'evidence-found': 'Evidence found',
  partial: 'Partial evidence',
  'not-found': 'Not found in sample',
};
export function RepositoryReview() {
  const [repository, setRepository] = useState('');
  const [rubricId, setRubricId] = useState('sanity-path-one');
  const [result, setResult] = useState<RepositoryReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storage);
      if (raw) {
        const saved = repositoryReportSchema.parse(JSON.parse(raw));
        setResult(saved);
        setRepository(saved.repository);
        setRubricId(saved.rubric.id);
      }
    } catch {
      setNotice('The previous review could not be restored. You can run a new review.');
    }
  }, []);
  async function review(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/repository-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: repository.trim(),
          rubricId: rubricIdSchema.parse(rubricId),
        }),
        signal: AbortSignal.timeout(240000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The review could not be completed.');
      const report = repositoryReportSchema.parse(body);
      setResult(report);
      try {
        localStorage.setItem(storage, JSON.stringify(report));
      } catch {
        setNotice(
          'This review is available now, but browser storage is full. Download a copy to keep it.',
        );
      }
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'The review timed out. Your previous result is unchanged. Try again later.'
          : e instanceof Error
            ? e.message
            : 'The review could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fineprint-repository-${result.commit.slice(0, 7)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const selected = rubrics.find((r) => r.id === rubricId)!;
  const changed =
    result &&
    (result.rubric.id !== rubricId || result.repository !== repository.trim().replace(/\/$/, ''));
  return (
    <div className="repo-page">
      <header className="app-bar">
        <a className="brand" href="/" aria-label="FinePrint home">
          <FileSearch size={23} /> FinePrint.
        </a>
        <a href="/review" className="repo-back">
          <ArrowLeft size={16} /> My reviews
        </a>
      </header>
      <main className="repo-main">
        <div className="repo-intro">
          <h1>What does your code prove?</h1>
          <p>
            Review a public GitHub repository against the event’s judging rubric. Find the evidence,
            the gaps, and your next useful fix.
          </p>
        </div>
        <form className="repo-form" onSubmit={review}>
          <label>
            GitHub repository
            <input
              type="url"
              required
              maxLength={240}
              placeholder="https://github.com/you/your-project"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Judging rubric
            <select value={rubricId} onChange={(e) => setRubricId(e.target.value)} disabled={busy}>
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : <Github size={17} />}{' '}
            {busy ? 'Reviewing repository…' : 'Review repository'}
          </button>
          <p className="repo-privacy">
            Reads up to 10 files from the current default-branch commit. Selected public code is
            sent to Modal for analysis; it is not uploaded to the public Sanity dataset. No code is
            executed. Uses the shared AI allowance.
          </p>
        </form>
        {busy && (
          <p role="status">
            Reading the rubric, selecting source files, then checking citations. This can take up to
            a few minutes.
          </p>
        )}
        {error && (
          <p role="alert" className="repo-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!result && (
          <section className="repo-rubric">
            <h2>What this review looks for</h2>
            <p>
              <a href={selected.sourceUrl}>Official rubric</a> · captured {selected.capturedAt}.
              Evidence prompts below are FinePrint’s guidance.
            </p>
            <ol>
              {selected.criteria.map((c) => (
                <li key={c.id}>
                  <h3>{c.title}</h3>
                  <p>{c.guidance}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
        {result && (
          <section className="repo-results" aria-label="Repository review result">
            <div className="repo-result-heading">
              <div>
                <h2>{result.rubric.title.replace(' judging rubric', '')}</h2>
                <p>
                  <a href={`${result.repository}/tree/${result.commit}`}>
                    {result.repository.replace('https://github.com/', '')} ·{' '}
                    {result.commit.slice(0, 7)}
                  </a>
                </p>
              </div>
              <button className="secondary-button" onClick={download}>
                <Download size={16} /> Download review
              </button>
            </div>
            {changed && (
              <p className="repo-notice">
                This saved result belongs to the repository and rubric shown above. Run another
                review to use your changed selection.
              </p>
            )}
            <p>
              Static evidence review · {new Date(result.reviewedAt).toLocaleString()} ·{' '}
              {result.coverage.inspected.length} of {result.coverage.totalFiles} files inspected.
              This is not a judging score or an eligibility verdict.
            </p>
            <p>
              <a href={result.rubric.sourceUrl}>Official criteria</a> · Sanity rubric version{' '}
              {result.rubric.version}
            </p>
            {result.findings.map((f) => (
              <article className="repo-finding" key={f.criterionId}>
                <header>
                  <h3>{result.rubric.criteria.find((c) => c.id === f.criterionId)?.title}</h3>
                  <span
                    className={`status-tag ${f.status === 'evidence-found' ? 'supported' : 'missing'}`}
                  >
                    {labels[f.status]}
                  </span>
                </header>
                <p>{f.summary}</p>
                {f.evidence.map((e, i) => (
                  <div className="repo-evidence" key={`${e.path}-${i}`}>
                    <a href={e.url}>
                      {e.path}:{e.start}–{e.end}
                    </a>
                    <span>
                      {e.kind === 'test'
                        ? 'Test code · not executed'
                        : e.kind === 'documentation'
                          ? 'Documentation claim'
                          : 'Implementation evidence'}
                    </span>
                    <pre>
                      <code>{e.quote}</code>
                    </pre>
                  </div>
                ))}
                {!f.evidence.length && (
                  <p>
                    No verified citation in the inspected sample. Relevant evidence may exist in
                    unread files.
                  </p>
                )}
                {f.discardedEvidence > 0 && (
                  <p>
                    {f.discardedEvidence} proposed citation(s) failed line verification and were
                    discarded.
                  </p>
                )}
                <div className="repo-next">
                  <strong>Next step</strong>
                  <p>{f.nextStep}</p>
                </div>
              </article>
            ))}
            <details className="repo-coverage">
              <summary>Inspect coverage and source reads</summary>
              <p>
                Selected from {result.coverage.listedFiles} listed candidates;{' '}
                {result.coverage.eligibleFiles} eligible text files. Large, binary, hidden,
                generated, secret-named and dependency files are excluded.{' '}
                {result.coverage.treeTruncated ? 'GitHub truncated the directory listing.' : ''}
              </p>
              <ul>
                {result.coverage.inspected.map((f) => (
                  <li key={f.path}>
                    {f.path} · {f.lines} lines{f.truncated ? ' · partial file' : ''}
                  </li>
                ))}
              </ul>
              {result.coverage.skipped.length > 0 && (
                <p>Not read: {result.coverage.skipped.join(', ')}</p>
              )}
              <h3>Sanity Context entries read</h3>
              <ul>
                {result.contextPaths.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
              <AgentTrace steps={result.trace} />
            </details>
            <p className="repo-privacy">
              Only the latest repository report is saved in this browser. Runtime behavior, real
              users and originality require separate verification. Existing eligibility reviews are
              unchanged.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
