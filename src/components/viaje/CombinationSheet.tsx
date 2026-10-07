'use client';

import { useEffect } from 'react';
import { X, Train, TramFront, ArrowRight, Clock, MapPin } from 'lucide-react';
import type { Combinacion } from '@/lib/combinaciones';

interface CombinationSheetProps {
  combinacion: Combinacion | null;
  /** Nombre de la parada donde se detecta la combinación (para contexto). */
  paradaNombre?: string;
  /** Callback cuando se cierra. */
  onClose: () => void;
}

const FRECUENCIA_TIPICA: Record<string, string> = {
  roca: '~5-10 min en hora pico',
  mitre: '~8-15 min en hora pico',
  sarmiento: '~10-20 min',
  sanmartin: '~15-30 min',
  belgranonorte: '~10-20 min',
  belgranosur: '~10-20 min',
  urquiza: '~15-30 min',
  A: '~3-5 min en hora pico',
  B: '~3-5 min en hora pico',
  C: '~4-7 min en hora pico',
  D: '~4-7 min en hora pico',
  E: '~5-8 min en hora pico',
  H: '~5-8 min en hora pico',
};

/**
 * Sheet con info del otro modo (tren o subte) disponible en la
 * parada. Se muestra cuando el usuario toca un badge de combinación
 * en el JourneyTimeline o en el Diagrama.
 *
 * Renderiza un bottom sheet en mobile y un modal centrado en desktop.
 */
export function CombinationSheet({ combinacion, paradaNombre, onClose }: CombinationSheetProps) {
  useEffect(() => {
    if (!combinacion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combinacion, onClose]);

  if (!combinacion) return null;

  const Icon = combinacion.mode === 'tren' ? Train : TramFront;
  const frecuencia = FRECUENCIA_TIPICA[combinacion.id] ?? '~5-10 min en hora pico';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Información de ${combinacion.label}`}
      className="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-canvas rounded-t-3xl sm:rounded-3xl border border-hairline shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] overflow-hidden"
      >
        <div className="px-5 pt-4 pb-4 flex items-start gap-3 border-b border-hairline-soft">
          <div
            className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white"
            style={{ backgroundColor: combinacion.color }}
            aria-hidden="true"
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              {combinacion.mode === 'tren' ? 'Tren' : 'Subte'}
            </p>
            <h2 className="mt-0.5 text-xl font-black text-ink leading-tight">
              {combinacion.label}
            </h2>
            {paradaNombre ? (
              <p className="mt-1 text-xs text-text-muted leading-snug break-words flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                En {paradaNombre}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-8 h-8 rounded-full bg-canvas-soft hover:bg-field flex items-center justify-center text-text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-canvas-soft flex items-center justify-center">
              <Clock className="w-4 h-4 text-ink" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Frecuencia típica
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink leading-tight">
                {frecuencia}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-canvas-soft flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-ink" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Sentido principal
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink leading-tight">
                Hacia {combinacion.sentidoDefault}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-canvas-soft border border-hairline">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Combinación
            </p>
            <p className="mt-1.5 text-xs text-text-muted leading-snug break-words">
              Desde esta parada podés combinar con la {combinacion.label} para extender tu
              recorrido. Bajate del colectivo y caminá hasta el andén correspondiente.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 rounded-2xl bg-ink text-canvas text-sm font-bold active:scale-[0.98] transition-transform"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
