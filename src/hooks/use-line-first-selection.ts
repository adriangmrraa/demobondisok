'use client';

import { useCallback, useMemo, useState } from 'react';
import { TransportService } from '@/lib/services/transport-service';
import {
  defaultSelection,
  mapHrefFor,
  resolveContext,
  switchDirection,
  switchRamal,
  type CatalogLine,
  type LineFirstSelection,
} from '@/lib/home/line-first';
import type { VehiclePosition } from '@/lib/data-service';

const MAX_ARRIVALS = 3;

function joinNumbers(numbers: string[]): string {
  if (numbers.length <= 1) return numbers.join('');
  return `${numbers.slice(0, -1).join(', ')} o la ${numbers[numbers.length - 1]}`;
}

/**
 * Estado del bloque "línea primero" (docs/HOME-LINEA-FIRST.md §4.1).
 * Los arribos salen de `TransportService.getLlegadasPorParada`, la misma
 * fuente que usan el mapa y el planner, y se refrescan con el feed de 1 Hz.
 */
export function useLineFirstSelection(catalog: CatalogLine[], positions: VehiclePosition[]) {
  const operationalNumbers = useMemo(
    () => catalog.filter((line) => line.operational).map((line) => line.number),
    [catalog],
  );
  const [selection, setSelection] = useState<LineFirstSelection | null>(() => {
    const first = catalog.find((line) => line.operational);
    return first ? defaultSelection(first.id) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);

  const context = useMemo(() => resolveContext(selection), [selection]);

  const selectLine = useCallback(
    (line: CatalogLine) => {
      if (!line.operational) {
        setNotice(
          `La línea ${line.number} todavía no tiene recorrido cargado en la demo. Probá con la ${joinNumbers(operationalNumbers)}.`,
        );
        return;
      }
      setNotice(null);
      setSelection((current) => (current?.lineId === line.id ? current : defaultSelection(line.id)));
    },
    [operationalNumbers],
  );

  const toggleDirection = useCallback(() => {
    setSelection((current) => (current ? switchDirection(current) : current));
  }, []);

  const selectRamal = useCallback((ramalId: string) => {
    setSelection((current) => (current ? switchRamal(current, ramalId) : current));
  }, []);

  const selectStop = useCallback((stopId: string) => {
    setSelection((current) => (current ? { ...current, stopId } : current));
  }, []);

  const arrivals = useMemo(() => {
    if (!context) return [];
    return TransportService.getLlegadasPorParada(context.stop.id, positions)
      .filter((arrival) => arrival.lineaId === context.line.id)
      .slice(0, MAX_ARRIVALS);
  }, [context, positions]);

  const linePositions = useMemo(() => {
    if (!context) return [];
    const filterByRamal = context.line.ramales.length > 1;
    return positions.filter(
      (p) => p.lineId === context.line.id && (!filterByRamal || p.ramalId === context.ramal.id),
    );
  }, [context, positions]);

  const frequencyMin = context?.line.frecuenciaPicoMin ?? 0;

  return {
    selection,
    context,
    notice,
    arrivals,
    linePositions,
    frequencyMin,
    perHour: frequencyMin > 0 ? Math.round(60 / frequencyMin) : 0,
    mapHref: context ? mapHrefFor(context) : '/mapas',
    selectLine,
    toggleDirection,
    selectRamal,
    selectStop,
  };
}

export type LineFirstState = ReturnType<typeof useLineFirstSelection>;
