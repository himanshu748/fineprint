'use client';

import { useState, type FormEvent } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';

export function AgentAccessForm({
  onAuthorized,
  onCancel,
  context = 'source-explanations',
}: {
  onAuthorized: () => void;
  onCancel: () => void;
  context?: 'source-explanations' | 'repository-review';
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The source agent could not be unlocked.');
      setCode('');
      onAuthorized();
    } catch (error) {
      setError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'Unlocking took too long. Check your connection and try again.'
          : error instanceof Error
            ? error.message
            : 'The source agent could not be unlocked.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="agent-access" onSubmit={(event) => void unlock(event)}>
      <h4>
        <LockKeyhole size={15} aria-hidden="true" />
        Source agent access
      </h4>
      <p>
        {context === 'repository-review'
          ? 'Enter the demo code to review public repositories for two hours. After unlocking, select Review repository to continue.'
          : 'Enter the demo code to use live source explanations for two hours. The rule report is available without it.'}
      </p>
      <label className="field">
        <span>Demo access code</span>
        <input
          autoFocus
          type="password"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={160}
          required
          disabled={busy}
        />
      </label>
      {error && (
        <p className="access-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="secondary-button" disabled={busy || !code}>
          {busy && <LoaderCircle size={14} className="spin" />}
          {busy ? 'Unlocking…' : 'Unlock source agent'}
        </button>
        <button type="button" className="text-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
