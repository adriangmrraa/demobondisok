import { Bus, Footprints, GitBranch, MapPin, Train, TramFront } from 'lucide-react';
import { useState } from 'react';
import { imperativeStepLabel } from '@/lib/journey-guide';
import { walkDirectionLabel } from '@/lib/walk-direction';
import { combinacionesDeParada, type Combinacion } from '@/lib/combinaciones';
import { CombinationSheet } from './CombinationSheet';
import type { TripStep } from '@/types/trip-planner';

interface JourneyTimelineProps {
  steps: TripStep[];
  /** Heading del usuario en grados (0=Norte). Opcional: si no se provee, las direcciones son absolutas. */
  userHeading?: number | null;
}

function StepIcon({ type }: { type: TripStep['type'] }) {
  if (type === 'walk') return <Footprints className="size-4" />;
  if (type === 'transfer') return <GitBranch className="size-4" />;
  return <Bus className="size-4" />;
}

export function JourneyTimeline({ steps, userHeading }: JourneyTimelineProps) {
  const [openCombinacion, setOpenCombinacion] = useState<Combinacion | null>(null);
  const [combinacionParada, setCombinacionParada] = useState<string | undefined>(undefined);

  const handleOpenCombinacion = (c: Combinacion, parada: string) => {
    setCombinacionParada(parada);
    setOpenCombinacion(c);
  };

  const handleCloseCombinacion = () => {
    setOpenCombinacion(null);
    setCombinacionParada(undefined);
  };

  return (
    <>
      <ol aria-label="Pasos del viaje" className="space-y-0">
        {steps.map((step, index) => {
          const combinaciones = step.toStopName ? combinacionesDeParada(step.toStopName) : [];
          return (
            <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < steps.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-hairline" />}
              <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${
                step.type === 'ride' ? 'border-electric-blue bg-electric-blue text-white' : step.type === 'transfer' ? 'border-amber-500/40 bg-amber-100 text-amber-800' : 'border-hairline bg-canvas-soft text-ink'
              }`}><StepIcon type={step.type} /></span>
              <div className="min-w-0 pt-0.5">
                <p className="font-bold leading-snug text-ink">{imperativeStepLabel(step, userHeading)}</p>
                {step.type === "walk" && step.walkBearing != null ? (
                  <p className="mt-1 text-xs font-semibold text-electric-blue">
                    {walkDirectionLabel(step.walkBearing, userHeading)}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted">
                  <span>{step.durationMinutes} min</span>
                  {step.stopCount ? <span>{step.stopCount} parada{step.stopCount === 1 ? '' : 's'}</span> : null}
                  {step.type === 'transfer' ? <span className="inline-flex items-center gap-1 font-semibold text-amber-800"><MapPin className="size-3" /> Punto de combinación</span> : null}
                </div>
                {step.type === 'ride' && step.ramalNombre ? <p className="mt-1 break-words text-xs font-medium text-text-muted">Hacia {step.ramalNombre}</p> : null}
                {step.type === 'ride' ? <p className="mt-1 break-words text-xs font-bold text-ink">Bajá en {step.toStopName}</p> : null}
                {combinaciones.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {combinaciones.map((c) => {
                      const Icon = c.mode === 'tren' ? Train : TramFront;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleOpenCombinacion(c, step.toStopName)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-canvas px-2 py-1 rounded-full active:scale-95 transition-transform hover:brightness-110"
                          style={{ backgroundColor: c.color }}
                          aria-label={`Ver información de combinación con ${c.label} en ${step.toStopName}`}
                        >
                          <Icon className="w-3 h-3" aria-hidden="true" />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <CombinationSheet
        combinacion={openCombinacion}
        paradaNombre={combinacionParada}
        onClose={handleCloseCombinacion}
      />
    </>
  );
}
