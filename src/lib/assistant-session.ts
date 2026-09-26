/**
 * AssistantSession — contexto persistido del asistente de /inicio (PBI-019).
 *
 * Guarda: consentimiento de ubicación (modal decorativo, demo simulada),
 * el lugar elegido en el selector (avenida/POI/parada) y la última consulta,
 * para que al re-tocar el chip vuelva la MISMA información (PBI-017).
 *
 * Regla de demo: un REFRESH del navegador (F5) limpia todo — Navigation
 * Timing type === "reload" — así el flujo permiso → selector → respuesta
 * se puede repetir con otros destinos. La navegación client-side de Next
 * (dock /mapas ↔ /inicio) NO es reload y conserva el estado.
 * TTL 12 h para no resucitar lugares de otro día.
 *
 * Módulo puro (sin React); el snapshot de useSyncExternalStore vive en
 * src/hooks/use-assistant-session.ts.
 */

import type { AssistantIntent } from '@/lib/services/assistant-intent-service';
import { SIMULATED_USER_LOCATION, type UserLocation } from '@/lib/config/user-location';

export const ASSISTANT_SESSION_KEY = 'rutaba_asistente_v1';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface AssistantLugar {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  /** Presente si el lugar coincide con una parada exacta del dataset. */
  stopId?: string;
}

export interface AssistantLastQuery {
  intent: AssistantIntent;
  destinoText?: string;
  lineaNumero?: string;
  /** Paso 2 del wizard completado (PBI-020): viaje desde esta parada. */
  originStopId?: string;
}

export interface AssistantSession {
  consentido: boolean;
  lugar: AssistantLugar | null;
  /** Paso 2 del wizard (PBI-020): id de la parada elegida como punto de espera. */
  paradaSelId: string | null;
  lastQuery: AssistantLastQuery | null;
  savedAt: number;
}

export const EMPTY_SESSION: AssistantSession = {
  consentido: false,
  lugar: null,
  paradaSelId: null,
  lastQuery: null,
  savedAt: 0,
};

let reloadChecked = false;

/** Borra la sesión si esta carga es un refresh (F5). Solo corre una vez. */
function ensureFreshOnReload(): void {
  if (typeof window === 'undefined' || reloadChecked) return;
  reloadChecked = true;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === 'reload') localStorage.removeItem(ASSISTANT_SESSION_KEY);
  } catch {
    /* performance/localStorage no disponibles: sesión vacía por defecto */
  }
}

export function parseAssistantSession(raw: string | null | undefined): AssistantSession {
  if (!raw) return EMPTY_SESSION;
  try {
    const parsed = JSON.parse(raw) as Partial<AssistantSession>;
    if (
      typeof parsed?.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      return EMPTY_SESSION;
    }
    return {
      consentido: parsed.consentido === true,
      lugar:
        parsed.lugar && typeof parsed.lugar.lat === 'number' && typeof parsed.lugar.lng === 'number'
          ? parsed.lugar
          : null,
      paradaSelId: typeof parsed.paradaSelId === 'string' ? parsed.paradaSelId : null,
      lastQuery:
        parsed.lastQuery && typeof parsed.lastQuery.intent === 'string'
          ? parsed.lastQuery
          : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

export function loadAssistantSession(): AssistantSession {
  ensureFreshOnReload();
  if (typeof window === 'undefined') return EMPTY_SESSION;
  try {
    return parseAssistantSession(localStorage.getItem(ASSISTANT_SESSION_KEY));
  } catch {
    return EMPTY_SESSION;
  }
}

export function readAssistantSessionRaw(): string {
  ensureFreshOnReload();
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(ASSISTANT_SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

export function serializeAssistantSession(session: AssistantSession): string {
  return JSON.stringify(session);
}

/** Merge parcial + fecha de guardado fresca. Devuelve la sesión resultante. */
export function saveAssistantSession(
  patch: Partial<Omit<AssistantSession, 'savedAt'>>,
): AssistantSession {
  const next: AssistantSession = { ...loadAssistantSession(), ...patch, savedAt: Date.now() };
  try {
    localStorage.setItem(ASSISTANT_SESSION_KEY, serializeAssistantSession(next));
  } catch {
    /* storage lleno o bloqueado: la sesión queda solo en memoria del hook */
  }
  return next;
}

export function clearAssistantSession(): void {
  try {
    localStorage.removeItem(ASSISTANT_SESSION_KEY);
  } catch {
    /* nada que limpiar */
  }
}

/** Referencia para resolveAssistantQuery: lugar elegido > ubicación simulada. */
export function assistantRefFromSession(session: AssistantSession): UserLocation {
  if (session.lugar) {
    return {
      lat: session.lugar.lat,
      lng: session.lugar.lng,
      name: session.lugar.name,
      isSimulated: false,
    };
  }
  return SIMULATED_USER_LOCATION;
}
