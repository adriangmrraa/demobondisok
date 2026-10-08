import type { TripOption, TripStep } from '@/types/trip-planner';
import { walkDirectionLabel } from './walk-direction';

export interface JourneyHero {
  lineNumber: string;
  direction: string;
  etaLabel: string;
  /** ETA crudo en minutos (null = sin seguimiento). El hero decide cómo mostrarlo. */
  etaMinutes: number | null;
  /** Color de la línea (para LineDisplay en el hero). */
  color: string;
  /** Color del texto sobre la línea. */
  textColor: string;
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
          etaMinutes:
            etaMinutes === undefined || etaMinutes === null || !Number.isFinite(etaMinutes)
              ? null
              : etaMinutes,
          color: firstRide.lineaColor || '#1D4ED8',
          textColor: firstRide.lineaTextColor || '#FFFFFF',
        }
      : null,
    steps: option.steps,
  };
}

/**
 * Etiqueta imperativa de un paso: acción + cuánto + hacia dónde, breve y accionable.
 * Si se conoce el heading del usuario y el step tiene bearing, la dirección es
 * relativa ("a tu izquierda", "al frente", "a tu derecha", "detrás tuyo");
 * si no, absoluta ("hacia el Norte"). Nunca se inventa una dirección: sin
 * bearing no se menciona dirección.
 *
 * `nextStep` se usa en transbordos para nombrar la línea que se toma después.
 */
export function imperativeStepLabel(
  step: TripStep,
  userHeading?: number | null,
  nextStep?: TripStep,
): string {
  const direction =
    step.walkBearing != null ? ` ${walkDirectionLabel(step.walkBearing, userHeading)}` : '';
  const stretch = step.distanceMeters ? `${step.distanceMeters} m${direction}` : '';

  if (step.focusPoint) {
    // Pseudo-step final "arrive": el colectivo llega a la parada del destino.
    return `Bajá en ${step.fromStopName}: llegás a ${step.toStopName}`;
  }

  if (step.type === 'walk') {
    if (step.fromStopId) {
      // Caminata de egreso: bajar del colectivo y seguir a pie hasta el destino.
      return `Bajá en ${step.fromStopName} y caminá ${stretch ? `${stretch} ` : ''}hasta ${step.toStopName}`;
    }
    return `Caminá ${stretch ? `${stretch} ` : ''}hasta ${step.toStopName}`;
  }

  if (step.type === 'transfer') {
    const nextLinea = nextStep?.type === 'ride' ? `la línea ${nextStep.lineaNumero}` : 'tu próximo colectivo';
    if (stretch) {
      return `Caminá ${stretch} hasta ${step.toStopName} para combinar con ${nextLinea}`;
    }
    return nextStep?.type === 'ride'
      ? `Combiná en ${step.toStopName} con ${nextLinea}`
      : `Combiná en ${step.toStopName} y seguí las indicaciones de la parada`;
  }

  if (step.lineaNumero) {
    const hacia = step.ramalNombre || step.toStopName;
    return `Tomá la línea ${step.lineaNumero} en ${step.fromStopName} hacia ${hacia}`;
  }
  return `Bajá en ${step.toStopName}`;
}
