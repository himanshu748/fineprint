'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyWorkspace,
  persistWorkspace,
  updateReview,
  workspaceKey,
  workspaceSchema,
  type PersonalReview,
  type ReviewWorkspace,
} from '@/lib/review-workspace';

export function useReviews() {
  const [workspace, setWorkspace] = useState<ReviewWorkspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [recoveryData, setRecoveryData] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const expected = useRef<string | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    try {
      expected.current = localStorage.getItem(workspaceKey);
      if (expected.current) {
        setWorkspace(workspaceSchema.parse(JSON.parse(expected.current)));
        setSavedAt(new Date().toISOString());
      }
    } catch {
      paused.current = true;
      setRecoveryData(expected.current);
      setStorageError(
        'Saved reviews could not be read. Autosave is paused and existing data has been preserved. You can still work here and download a backup.',
      );
    }
    setReady(true);
    function onStorage(event: StorageEvent) {
      if (
        (event.key === workspaceKey || event.key === null) &&
        event.newValue !== expected.current
      ) {
        paused.current = true;
        setStorageError(
          'Reviews changed in another tab. Download a backup of this copy if needed, then reload to use the latest saved reviews.',
        );
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready || paused.current) return;
    try {
      const next = persistWorkspace(localStorage, workspace, expected.current);
      if (next !== expected.current) setSavedAt(new Date().toISOString());
      expected.current = next;
    } catch (error) {
      paused.current = true;
      setStorageError(
        error instanceof Error && error.message.includes('another tab')
          ? error.message
          : 'Autosave is unavailable. Your changes remain in this tab. Download a backup before leaving.',
      );
    }
  }, [ready, workspace]);

  const update = useCallback((id: string, patch: Parameters<typeof updateReview>[2]) => {
    setWorkspace((current) => updateReview(current, id, patch));
  }, []);
  const activate = useCallback((id: string | null) => {
    setWorkspace((current) => ({ ...current, activeId: id }));
  }, []);
  const add = useCallback((review: PersonalReview) => {
    setWorkspace((current) => ({
      ...current,
      activeId: review.id,
      reviews: [review, ...current.reviews],
    }));
  }, []);
  const archive = useCallback((id: string, archived: boolean) => {
    setWorkspace((current) => ({
      ...current,
      activeId: archived && current.activeId === id ? null : current.activeId,
      reviews: current.reviews.map((r) => (r.id === id ? { ...r, archived } : r)),
    }));
  }, []);
  const removeArchived = useCallback((id: string) => {
    setWorkspace((current) => ({
      ...current,
      reviews: current.reviews.filter((r) => r.id !== id || !r.archived),
    }));
  }, []);
  return {
    workspace,
    ready,
    storageError,
    recoveryData,
    savedAt,
    update,
    activate,
    add,
    archive,
    removeArchived,
    setWorkspace,
  };
}
