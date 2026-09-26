/**
 * AssistantAnswerSheet — hoja fija de respuesta del asistente (INC-3).
 * Flota sobre el BottomNav en /inicio (bottom-[88px], misma cota que
 * LiveTransportBubble en /mapas). Contraíble por arrastre/tap con
 * useDragCollapse; el contenido por tipo de respuesta vive en
 * AssistantAnswerCard.
 */

'use client';

import { ChevronDown, MapPin, X } from 'lucide-react';
import { AssistantAnswerCard } from '@/components/home/AssistantAnswerCard';
import { useDragCollapse } from '@/lib/hooks/use-drag-collapse';
import type { AssistantAnswer } from '@/lib/services/assistant-intent-service';
import type { LocationPoint, TripOption } from '@/types/trip-planner';
import type { EstimacionLlegada } from '@/types/transport';
import { cn } from '@/lib/utils';

interface AssistantAnswerSheetProps {
  answer: AssistantAnswer;
  onClose: () => void;
  onSelectCandidate?: (candidate: LocationPoint) => void;
  onAskArrivalsAt?: (paradaId: string) => void;
  /** §3: abre el viaje en /mapas (origen+línea+ramal enfocados). Recibe el trip y su origen. */
  onOpenTripOnMap?: (trip: TripOption, origin: LocationPoint, boardingStopId?: string, arrival?: EstimacionLlegada) => void;
  /** sdd/trip-options-upgrade 2.5 (fix verify #4108): re-pick de destino desde el
   *  estado zero-bus; reabre el destino conservando el origen. Se reenvía a las
   *  cards para que el CTA de AssistantAnswerCard deje de estar huérfano. */
  onRepickDestination?: () => void;
  /** Segunda respuesta bajo la principal (resultado final del wizard: viaje + llegadas). */
  supplement?: AssistantAnswer | null;
  /** Lugar del flujo PBI-019 (avenida/POI elegido o demo). Se muestra en la barra. */
  contextLabel?: string;
  /** "Cambiar lugar": vuelve al selector sin pedir permiso de nuevo. */
  onChangePlace?: () => void;
}

export function AssistantAnswerSheet({
  answer,
  onClose,
  onSelectCandidate,
  onAskArrivalsAt,
  onOpenTripOnMap,
  onRepickDestination,
  supplement,
  contextLabel,
  onChangePlace,
}: AssistantAnswerSheetProps) {
  const { collapsed, toggle, handleProps } = useDragCollapse(false);

  return (
    <div className="fixed bottom-[88px] left-4 right-4 z-30 mx-auto max-w-[340px] pointer-events-auto">
      <div
        className={cn(
          'bg-canvas border border-hairline rounded-3xl shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18)] dark:shadow-[0_14px_40px_-6px_rgba(0,0,0,0.7)] overflow-hidden',
          collapsed ? 'h-[52px]' : 'max-h-[62dvh]',
        )}
      >
        {/* Handle: arrastre vertical o tap colapsa/expande.
            Una sola fila: pill "cambiar lugar" a la izquierda (trunca con
            ellipsis), y a la misma altura colapsar y X a la derecha. */}
        <div
          {...handleProps}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            toggle();
          }}
          className="flex flex-nowrap items-center gap-2 px-4 h-[52px] select-none cursor-grab active:cursor-grabbing"
          title={collapsed ? 'Expandar' : 'Contraer'}
        >
          <div className="flex items-center min-w-0 flex-1">
            {contextLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangePlace?.();
                }}
                aria-label={`Cambiar lugar. Actual: ${contextLabel}`}
                title={contextLabel}
                className={cn(
                  'flex items-center gap-1.5 min-w-0 max-w-full shrink',
                  'h-10 px-3 rounded-full bg-canvas-soft hover:bg-field border border-hairline',
                  'text-[11px] font-semibold text-text-muted hover:text-ink transition-colors',
                  'active:scale-[0.98] touch-manipulation',
                )}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0 text-electric-blue" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                  {contextLabel}
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              aria-label={collapsed ? 'Expandar respuesta' : 'Contraer respuesta'}
              className="w-9 h-9 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink transition-colors"
            >
              <ChevronDown className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Cerrar respuesta del asistente"
              className="w-9 h-9 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="px-2 pb-2 max-h-[calc(62dvh-60px)] overflow-y-auto overscroll-contain">
            <AssistantAnswerCard
              answer={answer}
              onSelectCandidate={onSelectCandidate}
              onAskArrivalsAt={onAskArrivalsAt}
              onOpenTripOnMap={onOpenTripOnMap}
              onRepickDestination={onRepickDestination}
              className="border-0 shadow-none p-2 rounded-2xl bg-canvas-soft/50"
            />
            {supplement && (
              <AssistantAnswerCard
                answer={supplement}
                onSelectCandidate={onSelectCandidate}
                onAskArrivalsAt={onAskArrivalsAt}
                onOpenTripOnMap={onOpenTripOnMap}
                onRepickDestination={onRepickDestination}
                className="mt-2 border-0 shadow-none p-2 rounded-2xl bg-canvas-soft/50"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
