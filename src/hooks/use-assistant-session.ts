/**
 * useAssistantSession — hook de React sobre el store puro de
 * assistant-session.ts (PBI-019). Mismo patrón useSyncExternalStore +
 * evento "storage" (sync cross-tab) y getServerSnapshot vacío, SSR-safe,
 * que use-favorites.
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  EMPTY_SESSION,
  parseAssistantSession,
  readAssistantSessionRaw,
  saveAssistantSession,
  serializeAssistantSession,
  clearAssistantSession,
  type AssistantSession,
  type AssistantLugar,
  type AssistantLastQuery,
} from '@/lib/assistant-session';

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getSnapshot(): string {
  return readAssistantSessionRaw();
}

function getServerSnapshot(): string {
  return '';
}

export function useAssistantSession() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = parseAssistantSession(raw || null);

  const writePatch = useCallback(
    (patch: Partial<Omit<AssistantSession, 'savedAt'>>) => {
      saveAssistantSession(patch);
      notify();
    },
    [],
  );

  const setConsentido = useCallback(
    (consentido: boolean) => writePatch({ consentido }),
    [writePatch],
  );

  const setLugar = useCallback(
    (lugar: AssistantLugar | null) => writePatch({ lugar }),
    [writePatch],
  );

  const setParadaSelId = useCallback(
    (paradaSelId: string | null) => writePatch({ paradaSelId }),
    [writePatch],
  );

  const setLastQuery = useCallback(
    (lastQuery: AssistantLastQuery | null) => writePatch({ lastQuery }),
    [writePatch],
  );

  const reset = useCallback(() => {
    clearAssistantSession();
    notify();
  }, []);

  return {
    session,
    isEmpty: session.savedAt === 0,
    emptySession: EMPTY_SESSION,
    snapshotForTests: serializeAssistantSession(session),
    setConsentido,
    setLugar,
    setParadaSelId,
    setLastQuery,
    reset,
  };
}
