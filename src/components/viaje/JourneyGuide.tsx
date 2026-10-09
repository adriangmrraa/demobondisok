import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowLeft, Map, Navigation, Route } from 'lucide-react';
import { buildJourneyGuideModel } from '@/lib/journey-guide';
import { tripMapUrlFromState, type TripMapNavigationState } from '@/lib/trip-map-navigation';
import type { TripOption, TripStep } from '@/types/trip-planner';
import { JourneyTimeline } from './JourneyTimeline';
import { TripDiagram } from './TripDiagram';
import { LineDisplay } from '@/components/ui/line-display';

interface JourneyGuideProps {
  option: TripOption;
  state: TripMapNavigationState;
  etaMinutes: number | null;
  onBackToOptions: () => void;
  /** Heading del usuario en grados (0=Norte). Opcional: si no se provee, las direcciones son absolutas. */
  userHeading?: number | null;
}

/**
 * ETA como pieza visual dominante del hero: número tabular grande, alto
 * contraste sobre bg-ink y aria-live para avisar cambios sin saltos de layout.
 * No recalcula ETA: sólo presenta el valor ya resuelto por el estado de viaje.
 */
function HeroEta({ etaMinutes, etaLabel }: { etaMinutes: number | null; etaLabel: string }) {
  if (etaMinutes === null) {
    return (
      <span aria-live="polite" className="text-base font-bold leading-snug text-canvas/80">
        Sin seguimiento en vivo
      </span>
    );
  }
  if (etaMinutes <= 0) {
    return (
      <span aria-live="polite" className="text-4xl font-black leading-none tracking-tight">
        Llegando
      </span>
    );
  }
  return (
    <span aria-live="polite" aria-label={etaLabel} className="flex flex-col items-end">
      <span className="flex items-baseline gap-1">
        <span className="text-6xl font-black leading-none tracking-tight tabular-nums">
          {Math.ceil(etaMinutes)}
        </span>
        <span className="text-xl font-black text-canvas/70">min</span>
      </span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-canvas/60">
        para que llegue
      </span>
    </span>
  );
}

export function JourneyGuide({ option, state, etaMinutes, onBackToOptions, userHeading }: JourneyGuideProps) {
  const model = buildJourneyGuideModel(option, etaMinutes);
  const mapState = { ...state, selectedTripId: option.id };
  const mapUrlForStep = (step: TripStep) =>
    tripMapUrlFromState({ ...mapState, stepId: step.id });
  return (
    <section aria-label="Guía de viaje" className="space-y-5">
      <button type="button" onClick={onBackToOptions} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink hover:text-electric-blue">
        <ArrowLeft className="size-4" /> Ver alternativas
      </button>
      {model.hero ? (
        <div
          className="rounded-3xl bg-ink p-5 text-canvas shadow-[0_16px_35px_-16px_rgba(0,0,0,0.65)]"
          style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${model.hero.color} 30%, #141414), #141414 72%)` }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-canvas/65">Tu próximo colectivo</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <LineDisplay
              number={model.hero.lineNumber}
              color={model.hero.color}
              textColor={model.hero.textColor}
              size="xl"
              aria-label={`Línea ${model.hero.lineNumber} en pantalla`}
            />
            <HeroEta etaMinutes={model.hero.etaMinutes} etaLabel={model.hero.etaLabel} />
          </div>
          <p className="mt-4 break-words text-base font-bold leading-snug">Hacia {model.hero.direction}</p>
          <p className="mt-1 text-sm leading-snug text-canvas/70">Esperalo en la parada indicada y seguí los pasos.</p>
        </div>
      ) : (
        <div className="home-surface rounded-3xl border border-hairline p-5">
          <p className="text-lg font-black text-ink">Este tramo es a pie</p>
          <p className="mt-1 text-sm text-text-muted">No necesitás esperar un colectivo para esta alternativa.</p>
        </div>
      )}
      <div className="home-surface rounded-3xl border border-hairline p-5">
        <div className="mb-5 flex items-center gap-2"><Navigation className="size-5 text-electric-blue" /><h2 className="text-lg font-black text-ink">Paso a paso</h2></div>
        <JourneyTimeline steps={model.steps} userHeading={userHeading} mapUrlForStep={mapUrlForStep} />
      </div>
      <div className="home-surface rounded-3xl border border-hairline p-5">
        <div className="mb-5 flex items-center gap-2"><Route className="size-5 text-electric-blue" /><h2 className="text-lg font-black text-ink">Recorrido</h2></div>
        <TripDiagram option={option} />
      </div>
      <Link
        href={tripMapUrlFromState(mapState)}
        style={model.hero ? ({ '--cta': model.hero.color } as CSSProperties) : undefined}
        className="home-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold text-white transition-all duration-300 active:scale-[0.98]"
      >
        <Map className="size-4" /> Ver el recorrido en el mapa
      </Link>
    </section>
  );
}
