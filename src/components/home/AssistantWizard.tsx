/**
 * AssistantWizard — flujo guiado de 3 pasos del "¿Cómo llego a…?" (PBI-020).
 *
 *  Paso 1 · Ubicación : confirma el punto de referencia (o "Cambiar" → selector).
 *  Paso 2 · Paradas    : elige la parada cercana donde vas a tomar el colectivo.
 *  Paso 3 · Destino    : escribe/valida el destino.
 *  → onComplete(paradaId, destinoText): la página resuelve el guide y lo muestra
 *    en el AssistantAnswerSheet (viaje + llegadas en ESA parada).
 *
 * No toca la máquina de fases del chip de llegadas: es un modal propio,
 * apilado sobre el sheet. Reusa los estilos de LocationConsentModal/PlaceSelector.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Navigation, Search, X } from 'lucide-react';
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import type { NearbyStopItem } from '@/lib/services/assistant-intent-service';
import type { LocationPoint } from '@/types/trip-planner';
import { LineBadge } from '@/components/ui/line-badge';
import { TransportService } from '@/lib/services/transport-service';
import { cn } from '@/lib/utils';

export type WizardStep = 'ubicacion' | 'paradas' | 'destino';

interface AssistantWizardProps {
  open: boolean;
  /** Referencia de ubicación ya resuelta (nombre + coords) para el paso 1. */
  locationName: string;
  /** Paradas cercanas al ref (paso 2). Se recalculan si cambia. */
  nearbyStops: NearbyStopItem[];
  /** Reanudación: abrir directo en un paso con datos ya elegidos (chip ya completado). */
  initialStep?: WizardStep;
  initialParadaId?: string | null;
  initialDestino?: string | null;
  /** Paso 1 completado y lugar confirmado → el padre abre el selector de lugar. */
  onChangeLocation: () => void;
  onClose: () => void;
  onComplete: (paradaId: string, destinoText: string) => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  ubicacion: 'Ubicación',
  paradas: 'Paradas cercanas',
  destino: 'Destino',
};

const STEP_ORDER: WizardStep[] = ['ubicacion', 'paradas', 'destino'];

function lineChip(lineId: string) {
  const l = TransportService.getLines().find((x) => x.id === lineId);
  return l ? { numero: l.numero, color: l.colorHex } : null;
}

export function AssistantWizard({
  open,
  locationName,
  nearbyStops,
  initialStep,
  initialParadaId,
  initialDestino,
  onChangeLocation,
  onClose,
  onComplete,
}: AssistantWizardProps) {
  const [step, setStep] = useState<WizardStep>(initialStep ?? 'ubicacion');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(initialParadaId ?? null);
  const [destino, setDestino] = useState(initialDestino ?? '');
  const destinoRef = useRef<HTMLInputElement>(null);

  // Reinicio al abrir: ajuste de estado durante el render (patrón React
  // "adjusting state on prop change"), no dentro de un effect. Si el padre
  // trae datos de una guía anterior, reanuda en el paso indicado.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(initialStep ?? 'ubicacion');
      setSelectedStopId(initialParadaId ?? null);
      setDestino(initialDestino ?? '');
    }
  }

  useEffect(() => {
    if (step === 'destino') destinoRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const selectedStop = useMemo(
    () => nearbyStops.find((s) => s.parada.id === selectedStopId)?.parada ?? null,
    [nearbyStops, selectedStopId],
  );

  // Sugerencias del destino en vivo sobre el geocoder local.
  const destinoSuggestions = useMemo(
    () => (destino.trim() ? TripPlannerService.searchLocations(destino).slice(0, 5) : []),
    [destino],
  );

  if (!open) return null;

  const stepIndex = STEP_ORDER.indexOf(step);
  const finish = () => {
    const dest = destino.trim() || destinoSuggestions[0]?.name || '';
    if (selectedStopId && dest) onComplete(selectedStopId, dest);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Asistente de viaje. Paso ${stepIndex + 1} de 3: ${STEP_LABELS[step]}`}
        className="w-full max-w-[400px] bg-canvas border border-hairline rounded-3xl shadow-[0_16px_45px_-6px_rgba(16,29,61,0.4)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header + stepper */}
        <div className="flex items-center justify-between gap-2 px-4 h-[52px] border-b border-hairline-soft">
          <div className="flex items-center gap-2 min-w-0">
            {step !== 'ubicacion' ? (
              <button
                type="button"
                onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
                aria-label="Volver al paso anterior"
                className="w-9 h-9 shrink-0 -ml-1 rounded-full hover:bg-canvas-soft flex items-center justify-center text-ink transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <Navigation className="w-4 h-4 text-electric-blue shrink-0" />
            )}
            <span className="text-sm font-bold text-ink truncate">
              {STEP_LABELS[step]}
              <span className="ml-1.5 text-[11px] font-medium text-text-faint">
                {stepIndex + 1}/3
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="w-9 h-9 shrink-0 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pips del stepper */}
        <div className="flex gap-1 px-4 pt-3">
          {STEP_ORDER.map((s, i) => (
            <span
              key={s}
              aria-hidden
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= stepIndex ? 'bg-ink' : 'bg-hairline',
              )}
            />
          ))}
        </div>

        <div className="p-4">
          {/* ─── PASO 1 · Ubicación ─── */}
          {step === 'ubicacion' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted leading-snug">
                Vamos a calcular tu viaje desde esta ubicación:
              </p>
              <div className="flex items-center gap-2.5 bg-canvas-soft border border-hairline rounded-2xl px-3.5 py-3">
                <span className="w-8 h-8 rounded-full bg-canvas border border-hairline flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-electric-blue" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink truncate" title={locationName}>
                    {locationName}
                  </span>
                  <span className="block text-[11px] text-text-faint">Punto de referencia</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onChangeLocation}
                className="self-start text-xs font-semibold text-electric-blue hover:underline"
              >
                Cambiar ubicación
              </button>
              <button
                type="button"
                onClick={() => setStep('paradas')}
                disabled={nearbyStops.length === 0}
                className="w-full min-h-[48px] bg-ink text-canvas rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"
              >
                Ver paradas cercanas <ArrowRight className="w-4 h-4" />
              </button>
              {nearbyStops.length === 0 && (
                <p className="text-xs text-text-muted">
                  No hay paradas de la red (65/194) cerca de este punto. Probá cambiar la ubicación.
                </p>
              )}
            </div>
          )}

          {/* ─── PASO 2 · Paradas cercanas ─── */}
          {step === 'paradas' && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-text-muted leading-snug mb-1">
                ¿En qué parada estás esperando?
              </p>
              <ul className="flex flex-col gap-1.5 max-h-[46dvh] overflow-y-auto overscroll-contain no-scrollbar">
                {nearbyStops.map(({ parada, distanceMeters, walkMinutes }) => {
                  const active = parada.id === selectedStopId;
                  return (
                    <li key={parada.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStopId(parada.id);
                          setStep('destino');
                        }}
                        className={cn(
                          'w-full text-left rounded-2xl border px-3.5 py-3 transition-colors flex items-center gap-3',
                          active
                            ? 'bg-canvas-soft border-ink'
                            : 'bg-canvas border-hairline hover:bg-canvas-soft',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink truncate" title={parada.nombre}>
                            {parada.nombre}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {distanceMeters >= 1000
                              ? `${(distanceMeters / 1000).toFixed(1)} km`
                              : `${distanceMeters} m`}
                            {' · '}
                            caminando ~{walkMinutes} min
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {parada.lineasIds
                            .map((id) => lineChip(id))
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((chip) => (
                              <LineBadge
                                key={chip!.numero}
                                shortName={chip!.numero}
                                color={chip!.color}
                                size="sm"
                              />
                            ))}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* ─── PASO 3 · Destino ─── */}
          {step === 'destino' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted leading-snug">
                ¿A dónde querés ir desde{' '}
                <span className="font-semibold text-ink">
                  {selectedStop?.nombre ?? 'tu parada'}
                </span>
                ?
              </p>
              <div className="group relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-ink transition-colors pointer-events-none" />
                <input
                  ref={destinoRef}
                  type="text"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      finish();
                    }
                  }}
                  placeholder="Escribí un lugar, avenida o parada…"
                  autoComplete="off"
                  aria-label="Destino del viaje"
                  className="w-full min-h-[46px] rounded-full bg-field border border-transparent pl-10 pr-4 text-sm text-ink placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-ink/20"
                />
              </div>
              {destino.trim() && (
                destinoSuggestions.length > 0 ? (
                  <ul className="flex flex-col gap-1 max-h-[32dvh] overflow-y-auto overscroll-contain no-scrollbar">
                    {destinoSuggestions.map((place: LocationPoint, i) => (
                      <li key={`${place.name}-${i}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setDestino(place.name);
                            if (selectedStopId) onComplete(selectedStopId, place.name);
                          }}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-canvas-soft transition-colors flex items-center gap-2.5"
                        >
                          <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink truncate">
                              {place.name}
                            </span>
                            {place.address && (
                              <span className="block text-[11px] text-text-muted truncate">
                                {place.address}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-text-muted">
                    No encuentro ese lugar. Probá con «Once», «Obelisco», «Cabildo»…
                  </p>
                )
              )}
              <button
                type="button"
                onClick={finish}
                disabled={!destino.trim() && destinoSuggestions.length === 0}
                className="w-full min-h-[48px] bg-ink text-canvas rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"
              >
                <Check className="w-4 h-4" /> Ver cómo llegar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
