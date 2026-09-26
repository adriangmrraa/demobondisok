'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface Favorite {
  stopId: string;
  addedAt: number;
}

const STORAGE_KEY = 'rutaba_favoritos';
const EMPTY = '[]';

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
  try {
    return localStorage.getItem(STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function getServerSnapshot(): string {
  return EMPTY;
}

function parse(raw: string): Favorite[] {
  try {
    const parsed = JSON.parse(raw) as Favorite[];
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f?.stopId === 'string') : [];
  } catch {
    return [];
  }
}

function write(favorites: Favorite[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    return false;
  }
  notify();
  return true;
}

export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favorites = parse(raw);

  const addFavorite = useCallback((stopId: string): boolean => {
    const current = parse(getSnapshot());
    if (current.some((f) => f.stopId === stopId)) return true;
    return write([{ stopId, addedAt: Date.now() }, ...current]);
  }, []);

  const removeFavorite = useCallback((stopId: string): boolean => {
    return write(parse(getSnapshot()).filter((f) => f.stopId !== stopId));
  }, []);

  const toggleFavorite = useCallback((stopId: string): boolean => {
    const current = parse(getSnapshot());
    if (current.some((f) => f.stopId === stopId)) {
      return write(current.filter((f) => f.stopId !== stopId));
    }
    return write([{ stopId, addedAt: Date.now() }, ...current]);
  }, []);

  return {
    favorites,
    isFavorite: (stopId: string) => favorites.some((f) => f.stopId === stopId),
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
