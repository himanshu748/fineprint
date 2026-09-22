'use client';

import { useRef, useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  FileSearch,
  FolderOpen,
  Plus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import type { Dossier } from '@/lib/model';
import {
  exportWorkspace,
  maxBackupBytes,
  reviewIsStale,
  type PersonalReview,
  type ReviewWorkspace,
} from '@/lib/review-workspace';

export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pathNames = {
  'path-one': 'Path One · agent',
  'path-two': 'Path Two · app',
  both: 'Both paths',
};
type Creation = Pick<Dossier, 'name' | 'track' | 'origin' | 'startedAt'>;

export function ReviewLibrary({
  workspace,
  ready,
  startCreating,
  savedCount,
  onCreate,
  onOpen,
  onArchive,
  onRemoveArchived,
  onImport,
  onExample,
  onSnapshots,
  onSources,
}: {
  workspace: ReviewWorkspace;
  ready: boolean;
  startCreating: boolean;
  savedCount: number;
  onCreate: (details: Creation) => boolean;
  onOpen: (review: PersonalReview) => void;
  onArchive: (id: string, archived: boolean) => void;
  onRemoveArchived: (id: string) => void;
  onImport: (raw: string) => void;
  onExample: () => void;
  onSnapshots: () => void;
  onSources: () => void;
}) {
  const [creating, setCreating] = useState(
    startCreating || !workspace.reviews.some((r) => !r.archived),
  );
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [track, setTrack] = useState<Dossier['track']>('path-one');
  const [origin, setOrigin] = useState<Dossier['origin']>(null);
  const [startedAt, setStartedAt] = useState('');
  const [importError, setImportError] = useState('');
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reviews = workspace.reviews
    .filter((r) => r.archived === showArchived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const hasReviews = workspace.reviews.length > 0;

  return (
    <div className="review-library">
      <div className="library-heading">
        <div>
          <h1>{hasReviews ? 'Your reviews' : 'Check your next submission.'}</h1>
          <p>
            {hasReviews
              ? 'Pick up where you left off. Your work stays on this device.'
              : 'Add what you know. Find the rule or missing fact that needs your attention.'}
          </p>
        </div>
        {hasReviews && (
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={17} /> New review
          </button>
        )}
      </div>

      <div className="supported-event">
        <BookOpen size={22} />
        <div>
          <strong>DEV × Sanity Challenge</strong>
          <p>The currently supported event · closes October 4, 2026</p>
        </div>
        <button className="text-button" onClick={onSources}>
          View covered rules <ArrowRight size={15} />
        </button>
      </div>

      {creating && (
        <section className="review-create" aria-labelledby="create-review-title">
          <div className="create-description">
            <FileSearch size={28} strokeWidth={1.5} />
            <h2 id="create-review-title">Start with your project.</h2>
            <p>
              No account needed. Leave anything you don’t know unanswered; FinePrint will ask for it
              when it matters.
            </p>
            <button className="text-button" onClick={onExample}>
              Explore a sample review <ArrowRight size={15} />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onCreate({ name, track, origin, startedAt: startedAt || null });
            }}
          >
            <label className="field">
              <span>Project name</span>
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen notebook"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Submission path</span>
              <select value={track} onChange={(e) => setTrack(e.target.value as Dossier['track'])}>
                <option value="path-one">Path One · an agent using Sanity Context</option>
                <option value="path-two">Path Two · an app built with AI and Sanity</option>
                <option value="both">Both paths · separate submissions</option>
              </select>
            </label>
            <div className="create-optional">
              <label className="field">
                <span>What existed before the event?</span>
                <select
                  value={origin ?? 'unknown'}
                  onChange={(e) =>
                    setOrigin(
                      e.target.value === 'unknown' ? null : (e.target.value as Dossier['origin']),
                    )
                  }
                >
                  <option value="unknown">Not sure yet</option>
                  <option value="new">Nothing · a new entry</option>
                  <option value="components">Only components I’m reusing</option>
                  <option value="existing">The application itself</option>
                </select>
              </label>
              <label className="field">
                <span>
                  Development began <small>optional</small>
                </span>
                <input
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </label>
            </div>
            <div className="create-actions">
              <button className="primary-button" type="submit" disabled={!ready || !name.trim()}>
                Create my review <ArrowRight size={17} />
              </button>
              {hasReviews && (
                <button className="text-button" type="button" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              )}
            </div>
            <p className="create-note">
              Rule checks are free and don’t use the shared AI allowance.
            </p>
          </form>
        </section>
      )}

      {hasReviews && (
        <section className="personal-reviews" aria-label="Saved reviews">
          <div className="review-list-heading">
            <h2>{showArchived ? 'Archived reviews' : 'Continue a review'}</h2>
            <button className="text-button" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Show active reviews' : 'Show archived'}
            </button>
          </div>
          {reviews.length ? (
            <div className="personal-review-list">
              {reviews.map((review) => (
                <article key={review.id}>
                  <FolderOpen size={23} strokeWidth={1.5} />
                  <div className="personal-review-copy">
                    <h3>{review.dossier.name || 'Untitled review'}</h3>
                    <p>
                      {reviewIsStale(review)
                        ? 'Facts updated · recheck to refresh the report'
                        : (review.report?.summary ?? 'Draft · ready for a first check')}
                    </p>
                    <small>
                      {pathNames[review.dossier.track]} · edited{' '}
                      {new Date(review.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  {review.archived ? (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() => onArchive(review.id, false)}
                      >
                        <RotateCcw size={15} /> Restore
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Permanently delete “${review.dossier.name || 'Untitled review'}” from this browser? Download a backup first if you want to keep it.`,
                            )
                          )
                            onRemoveArchived(review.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary-button" onClick={() => onOpen(review)}>
                        Continue <ArrowRight size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Archive ${review.dossier.name || 'untitled review'}`}
                        onClick={() => onArchive(review.id, true)}
                      >
                        <Archive size={17} />
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="library-empty">
              {showArchived
                ? 'No archived reviews.'
                : 'Your reviews are archived. Restore one or start a new review.'}
            </p>
          )}
        </section>
      )}

      <div className="workspace-backup">
        <div>
          <h2>Keep a copy you control.</h2>
          <p>
            Download your project facts to move to another browser. Imports keep existing reviews
            and ask you to recheck the rules.
          </p>
        </div>
        <div className="backup-actions">
          <button
            className="secondary-button"
            disabled={!hasReviews}
            onClick={() => downloadText(exportWorkspace(workspace), 'fineprint-reviews.json')}
          >
            <ArrowDownToLine size={16} /> Download backup
          </button>
          <button
            className="secondary-button"
            disabled={reading || !ready}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} /> {reading ? 'Reading backup…' : 'Import backup'}
          </button>
          <input
            className="visually-hidden"
            tabIndex={-1}
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Choose FinePrint backup"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              setImportError('');
              setReading(true);
              try {
                if (file.size > maxBackupBytes)
                  throw new Error('Choose a FinePrint backup under 500 KB.');
                onImport(await file.text());
              } catch (error) {
                setImportError(
                  error instanceof Error ? error.message : 'This backup could not be read.',
                );
              } finally {
                setReading(false);
              }
            }}
          />
        </div>
        {importError && (
          <p className="backup-error" role="alert">
            {importError}
          </p>
        )}
      </div>
      <p className="workspace-privacy">
        Reviews are saved in this browser, not synced to an account. Clearing browser data removes
        them. Back up anything you want to keep. You can keep up to 30 reviews, including archived
        ones.
      </p>
      {savedCount > 0 && (
        <button className="text-button legacy-reports" onClick={onSnapshots}>
          Open {savedCount} earlier saved {savedCount === 1 ? 'report' : 'reports'}{' '}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
