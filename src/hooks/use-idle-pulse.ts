'use client';

import { useEffect, useState } from 'react';

/** Cadencia del loop idle compartido del Home (nudge del carrusel + chevron). */
const IDLE_INTERVAL_MS = 8000;
/** Retardo del primer pulso: deja pasar el velo de apertura y la entrada. */
const FIRST_PULSE_MS = 900;

/**
 * Emite un pulso al montar (tras la entrada) y cada ~8 s. Lo consumen el hint
 * del carrusel de líneas y el bounce del chevron de "Tu parada" con un ÚNICO
 * timer. Con "reducir movimiento" activo no emite pulsos.
 */
export function useIdlePulse(intervalMs: number = IDLE_INTERVAL_MS): number {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bump = () => setPulse((value) => value + 1);
    const first = window.setTimeout(bump, FIRST_PULSE_MS);
    const timer = window.setInterval(bump, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return pulse;
}
