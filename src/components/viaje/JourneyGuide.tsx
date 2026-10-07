import Link from 'next/link';
import { ArrowLeft, Map, Navigation, Route } from 'lucide-react';
import { buildJourneyGuideModel } from '@/lib/journey-guide';
import { tripMapUrlFromState, type TripMapNavigationState } from '@/lib/trip-map-navigation';
import type { TripOption } from '@/types/trip-planner';
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

export function JourneyGuide({ option, state, etaMinutes, onBackToOptions, userHeading }: JourneyGuideProps) {
  const model = buildJourneyGuideModel(option, etaMinutes);
  const mapState = { ...state, selectedTripId: option.id };
  return (
    <section aria-label="Guía de viaje" className="space-y-5">
      <button type="button" onClick={onBackToOptions} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink hover:text-electric-blue">
        <ArrowLeft className="size-4" /> Ver alternativas
      </button>
      {model.hero ? (
        <div className="rounded-3xl bg-ink p-5 text-canvas shadow-[0_16px_35px_-16px_rgba(0,0,0,0.65)]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-canvas/65">Tu próximo colectivo</p>
          <div className="mt-3 flex items-end gap-4">
            <LineDisplay
              number={model.hero.lineNumber}
              color={model.hero.color}
              textColor={model.hero.textColor}
              size="xl"
              aria-label={`Línea ${model.hero.lineNumber} en pantalla`}
            />
            <span className="mb-1 rounded-full bg-[#dcfce7] px-3 py-1.5 text-sm font-black text-[#166534]">{model.hero.etaLabel}</span>
          </div>
          <p className="mt-4 break-words text-base font-bold leading-snug">Hacia {model.hero.direction}</p>
          <p className="mt-1 text-sm leading-snug text-canvas/70">Esperalo en la parada indicada y seguí los pasos.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-hairline bg-canvas-soft p-5">
          <p className="text-lg font-black text-ink">Este tramo es a pie</p>
          <p className="mt-1 text-sm text-text-muted">No necesitás esperar un colectivo para esta alternativa.</p>
        </div>
      )}
      <div className="rounded-3xl border border-hairline bg-canvas p-5">
        <div className="mb-5 flex items-center gap-2"><Navigation className="size-5 text-electric-blue" /><h2 className="text-lg font-black text-ink">Paso a paso</h2></div>
        <JourneyTimeline steps={model.steps} userHeading={userHeading} />
      </div>
      <div className="rounded-3xl border border-hairline bg-canvas p-5">
        <div className="mb-5 flex items-center gap-2"><Route className="size-5 text-electric-blue" /><h2 className="text-lg font-black text-ink">Recorrido</h2></div>
        <TripDiagram option={option} />
      </div>
      <Link href={tripMapUrlFromState(mapState)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas font-bold text-ink transition-colors hover:bg-canvas-soft">
        <Map className="size-4" /> Ver el recorrido en el mapa
      </Link>
    </section>
  );
}
