import type { TripOption, TripStep } from '@/types/trip-planner';

export interface JourneyHero {
  lineNumber: string;
  direction: string;
  etaLabel: string;
}

export interface JourneyGuideModel {
  hero: JourneyHero | null;
  steps: TripStep[];
}

export function journeyEtaLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return 'Sin seguimiento en vivo';
  }
  if (minutes <= 0) return 'Arribando ahora';
  return `Arriba en ${Math.ceil(minutes)} min`;
}

/** Presentation-only adapter: the planner stays the source of truth. */
export function buildJourneyGuideModel(
  option: TripOption,
  etaMinutes?: number | null,
): JourneyGuideModel {
  const firstRide = option.steps.find((step) => step.type === 'ride');
  return {
    hero: firstRide?.lineaNumero
      ? {
          lineNumber: firstRide.lineaNumero,
          direction: firstRide.ramalNombre || firstRide.toStopName,
          etaLabel: journeyEtaLabel(etaMinutes),
        }
      : null,
    steps: option.steps,
  };
}

export function imperativeStepLabel(step: TripStep): string {
  if (step.type === 'walk') {
    const distance = step.distanceMeters ? ` ${step.distanceMeters} metros` : '';
    return `Caminá${distance} hasta ${step.toStopName}`;
  }
  if (step.type === 'transfer') {
    return `Combiná en ${step.toStopName} y seguí las indicaciones de la parada`;
  }
  if (step.lineaNumero) {
    return `Esperá el ${step.lineaNumero} hacia ${step.ramalNombre || step.toStopName}`;
  }
  return `Bajá en ${step.toStopName}`;
}
