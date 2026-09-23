'use client';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { rulePackSchema, eventIdSchema, type EventId, type RulePack } from '@/lib/model';
const schema = z.object({
  checkedAt: z.iso.datetime(),
  events: z.array(z.object({ pack: rulePackSchema, mode: z.enum(['sanity', 'snapshot']) })),
  unavailable: z.array(eventIdSchema),
});
export function useRulePacks() {
  const [packs, setPacks] = useState<Partial<Record<EventId, RulePack>>>({});
  const [mode, setMode] = useState<'sanity' | 'snapshot'>('snapshot');
  const [busy, setBusy] = useState(true);
  const [checkedAt, setCheckedAt] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/events', { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error();
      const result = schema.parse(await response.json());
      setPacks(Object.fromEntries(result.events.map(({ pack }) => [pack.id, pack])));
      setMode(result.events.every(({ mode }) => mode === 'sanity') ? 'sanity' : 'snapshot');
      setCheckedAt(result.checkedAt);
      if (result.unavailable.length)
        setError('Some current rule packs are unavailable. Previous reports have not changed.');
    } catch {
      setPacks({});
      setError(
        'Current rule versions could not be loaded. Retry before relying on an older report.',
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { packs, mode, busy, checkedAt, error, refresh };
}
