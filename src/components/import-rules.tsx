'use client';

import { useState } from 'react';
import { ArrowRight, CircleAlert, ExternalLink, LoaderCircle, Plus, X } from 'lucide-react';
import { z } from 'zod';
import {
  importedEventSchema,
  importedLabel,
  importSummary,
  type ImportedEvent,
} from '@/lib/imported-event';
import { AgentAccessForm } from './agent-access-form';

const responseSchema = z.object({ event: importedEventSchema, cached: z.boolean() });

export function ImportedEventSummary({
  event,
  cached = false,
}: {
  event: ImportedEvent;
  cached?: boolean;
}) {
  const counts = importSummary(event);
  return (
    <div className="import-summary" role="status">
      <p className="import-label">
        {importedLabel(event)} · captured {new Date(event.importedAt).toLocaleString()}
        {cached ? ' · reused from an earlier import of the same page' : ''}
      </p>
      <strong>{event.title}</strong>
      <ul>
        <li>
          <b>{counts.found}</b> requirements found
        </li>
        <li>
          <b>{counts.mapped}</b> map to checks
        </li>
        <li>
          <b>{counts.checkYourself}</b> to check yourself
        </li>
        <li>
          <b>{counts.dropped}</b> {counts.dropped === 1 ? 'quote' : 'quotes'} dropped
        </li>
      </ul>
      <p>
        {event.deadline
          ? `Deadline ${new Date(event.deadline).toLocaleString()}, as quoted on the page.`
          : 'No deadline with a timezone was quoted, so FinePrint does not show one.'}{' '}
        {counts.dropped > 0 &&
          'Dropped quotes were not found word for word on the page, so those rules were left out.'}
      </p>
      {counts.dropped > 0 && (
        <details>
          <summary>Show dropped quotes</summary>
          <ul>
            {event.dropped.map((item, index) => (
              <li key={index}>
                <strong>{item.title}</strong> <q>{item.quote}</q>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="import-pages">
        {event.pages.map((page) => (
          <a key={page.id} href={page.url} rel="noreferrer" target="_blank">
            {new URL(page.url).pathname || '/'}
            <ExternalLink size={12} />
          </a>
        ))}
      </p>
    </div>
  );
}

export function ImportRulesForm({
  onImported,
}: {
  onImported: (event: ImportedEvent, cached: boolean) => void;
}) {
  const [url, setUrl] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unlock, setUnlock] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, extra: extra.filter((item) => item.trim()) }),
        signal: AbortSignal.timeout(200_000),
      });
      const raw = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (raw.code === 'ACCESS_REQUIRED') setUnlock(true);
        throw new Error(typeof raw.error === 'string' ? raw.error : 'The import did not finish.');
      }
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success)
        throw new Error('The imported rules could not be validated. Nothing was saved.');
      onImported(parsed.data.event, parsed.data.cached);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name === 'TimeoutError'
          ? 'The import took too long. Try again later.'
          : failure instanceof Error
            ? failure.message
            : 'The import did not finish.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-rules">
      <label className="field">
        <span>Rules or overview page</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://example.devpost.com/rules"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
        />
        <small>
          Devpost, DEV, lablab.ai, MLH or the event’s own site. The page must be public.
        </small>
      </label>
      {extra.map((value, index) => (
        <label className="field import-extra" key={index}>
          <span>Another page on the same site</span>
          <span className="import-extra-row">
            <input
              type="url"
              inputMode="url"
              placeholder="https://example.devpost.com/faq"
              value={value}
              disabled={busy}
              onChange={(e) =>
                setExtra(extra.map((item, i) => (i === index ? e.target.value : item)))
              }
              autoComplete="off"
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Remove this page"
              disabled={busy}
              onClick={() => setExtra(extra.filter((_, i) => i !== index))}
            >
              <X size={16} />
            </button>
          </span>
        </label>
      ))}
      <div className="import-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy || !/^https:\/\/\S+\.\S+/.test(url.trim())}
          onClick={() => void submit()}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}
          {busy ? 'Reading the rules…' : 'Read the rules'}
        </button>
        {extra.length < 2 && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setExtra([...extra, ''])}
          >
            <Plus size={15} /> Add a separate rules or FAQ page
          </button>
        )}
      </div>
      {busy && (
        <p className="import-progress" role="status">
          Fetching the page, asking the model for requirements and matching every quote to the page
          text. This usually takes under a minute.
        </p>
      )}
      {unlock && (
        <AgentAccessForm
          onAuthorized={() => {
            setUnlock(false);
            setError('');
          }}
          onCancel={() => setUnlock(false)}
        />
      )}
      {error && (
        <p className="backup-error" role="alert">
          <CircleAlert size={15} /> {error}
        </p>
      )}
      <p className="create-note">
        Importing uses one run of the shared AI allowance (five per ten minutes). The page text is
        sent to Modal. Imported rules stay in this browser and are marked as not reviewed.
      </p>
    </div>
  );
}
