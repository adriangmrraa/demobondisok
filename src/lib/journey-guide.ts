import type { TripOption, TripStep } from '@/types/trip-planner';
import { walkDirectionLabel } from './walk-direction';

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

/**
 * Etiqueta imperativa de un paso. Si se conoce el heading del usuario
 * y el step es walk con bearing, la descripción incluye la dirección
 * relativa ("a tu izquierda", "al frente", "a tu derecha", "detrás tuyo").
 */
export function imperativeStepLabel(step: TripStep, userHeading?: number | null): string {
  if (step.type === 'walk') {
    const distance = step.distanceMeters ? ` ${step.distanceMeters} metros` : '';
    const direction = step.walkBearing != null ? ` (${walkDirectionLabel(step.walkBearing, userHeading)})` : '';
    return `Caminá${distance} hasta ${step.toStopName}${direction}`;
  }
  if (step.type === 'transfer') {
    return `Combiná en ${step.toStopName} y seguí las indicaciones de la parada`;
  }
  if (step.lineaNumero) {
    return `Esperá el ${step.lineaNumero} hacia ${step.ramalNombre || step.toStopName}`;
  }
  return `Bajá en ${step.toStopName}`;
}
