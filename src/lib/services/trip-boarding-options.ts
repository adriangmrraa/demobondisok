/**
 * TripBoardingOptions — per-boarding-stop 3-row model (sdd/trip-options-upgrade).
 *
 * Joins `planTrip` geometry (TripOption) × `getLlegadasPorParada` live units
 * (EstimacionLlegada) into ≤3 tappable rows per boarding stop:
 *   - same-nearest: nearest unit on the recommended line
 *   - same-late: second unit on the same line (different ETA, same bus line)
 *   - other-line: best unit on another line serving the same stop
 *
 * Pure derivation — no store change, no routing/ETA rewrite. Cap stays 3.
 * Resolver must match `selectedBoardingUnitKey` (lineId+interno) and fall back
 * to pin › seed › arrivals[0]; never collapse to arrivals[0] when a tap exists.
 */

import type { TripOption } from "@/types/trip-planner";
import type { EstimacionLlegada } from "@/types/transport";

export type SelectedBoardingUnitKey = string;

export type BoardingOptionKind = "same-nearest" | "same-late" | "other-line";

export interface BoardingOptionRow {
  unitKey: SelectedBoardingUnitKey;
  lineaId: string;
  lineaNumero: string;
  interno: string;
  etaMin: number;
  displayLabel: string;
  displayStatus: "en-parada" | "arribando" | "minutos";
  kind: BoardingOptionKind;
  ramal: string;
  colorHex: string;
}

export function boardingUnitKeyOf(lineaId: string, interno: string): SelectedBoardingUnitKey {
  return `${lineaId}-${interno}`;
}

function toRow(
  a: EstimacionLlegada,
  kind: BoardingOptionKind,
): BoardingOptionRow {
  return {
    unitKey: boardingUnitKeyOf(a.lineaId, a.interno),
    lineaId: a.lineaId,
    lineaNumero: a.lineaNumero,
    interno: a.interno,
    etaMin: a.minutos,
    displayLabel: a.displayLabel ?? (a.minutos <= 0 ? "En parada" : `${a.minutos} min`),
    displayStatus: a.displayStatus ?? (a.minutos <= 1 ? "en-parada" : a.minutos <= 2 ? "arribando" : "minutos"),
    kind,
    ramal: a.ramal,
    colorHex: a.colorHex,
  };
}

/**
 * Build ≤3 boarding rows for the given trip + live arrivals at its boarding stop.
 * Ordering: same-nearest, same-late, other-line (each group already ETA-sorted).
 */
export function buildBoardingOptions(
  trip: TripOption | null,
  arrivals: EstimacionLlegada[],
): BoardingOptionRow[] {
  if (!trip || arrivals.length === 0) return [];
  const sorted = [...arrivals].sort((a, b) => a.minutos - b.minutos);
  const rideLineId = trip.legs.find((leg) => leg.type === "ride")?.lineaId ?? null;

  if (!rideLineId) {
    return sorted.slice(0, 3).map((a) => toRow(a, "other-line"));
  }

  const same = sorted.filter((a) => a.lineaId === rideLineId);
  const other = sorted.filter((a) => a.lineaId !== rideLineId);

  const rows: BoardingOptionRow[] = [];
  if (same[0]) rows.push(toRow(same[0], "same-nearest"));
  if (same[1]) rows.push(toRow(same[1], "same-late"));
  if (other[0] && rows.length < 3) rows.push(toRow(other[0], "other-line"));

  // Degraded feed: fill up to 3 (fallback yields 2/line → at least 2 rows).
  if (rows.length < 3) {
    for (const a of same.slice(2)) {
      if (rows.length >= 3) break;
      rows.push(toRow(a, "same-late"));
    }
  }
  if (rows.length < 3) {
    for (const a of other.slice(1)) {
      if (rows.length >= 3) break;
      rows.push(toRow(a, "other-line"));
    }
  }
  return rows.slice(0, 3);
}

/**
 * Live hero/footer label mapping (sdd/trip-options-upgrade display domain).
 * Maps EstimacionLlegada live fields to header copy:
 *   minutos → "Llega en X min", arribando → "Arribando", en-parada → "En parada".
 * Keeps aria-live + kill-switch classes untouched (presentation only).
 */
export function boardingHeroLabel(
  arrival: Pick<EstimacionLlegada, "minutos" | "displayStatus" | "displayLabel"> | null | undefined,
): string | null {
  if (!arrival) return null;
  if (arrival.displayStatus === "en-parada") return "En parada";
  if (arrival.displayStatus === "arribando") return "Arribando";
  const min = Math.max(1, arrival.minutos);
  return `Llega en ${min} min`;
}
