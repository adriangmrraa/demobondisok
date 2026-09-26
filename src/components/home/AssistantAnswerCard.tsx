/**
 * AssistantAnswerCard — contenido de la respuesta del asistente (INC-2).
 * En /inicio se renderiza inline debajo de la barra; el chrome de hoja fija
 * (drag/collapse) se agrega encima en INC-3 sin cambiar este contenido.
 */

'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, MapPin, Navigation } from 'lucide-react';
import { LineBadge } from '@/components/ui/line-badge';
import type { AssistantAnswer } from '@/lib/services/assistant-intent-service';
import type { LocationPoint, TripOption } from '@/types/trip-planner';
import type { EstimacionLlegada } from '@/types/transport';
import { buildTripMapUrl } from '@/lib/trip-map-navigation';
import { cn } from '@/lib/utils';

interface AssistantAnswerCardProps {
  answer: AssistantAnswer;
  /** El usuario elige un candidato del clarify ("¿quisiste decir…?"). */
  onSelectCandidate?: (candidate: LocationPoint) => void;
  /** El usuario pide "¿cuándo llega?" en una parada concreta (refinamiento). */
  onAskArrivalsAt?: (paradaId: string) => void;
  /** §3: tocar el viaje cierra/minimiza el modal y abre /mapas con todo enfocado. */
  onOpenTripOnMap?: (trip: TripOption, origin: LocationPoint, boardingStopId?: string, arrival?: EstimacionLlegada) => void;
  /** sdd/trip-options-upgrade 2.5: re-pick de destino (reusa handleSelectDestination del padre). */
  onRepickDestination?: () => void;
  className?: string;
}

/** One portable contract for Home and Mi Viaje navigation. */
export function tripMapUrl(
  trip: TripOption,
  origin: LocationPoint,
  options: { boardingStopId?: string; arrival?: EstimacionLlegada } = {},
): string {
  return buildTripMapUrl(trip, origin, { boardingStopId: options.boardingStopId ?? origin.stopId, arrival: options.arrival });
}

const FEASIBILITY_STYLE: Record<string, string> = {
  'on-time': 'bg-[#dcfce7] text-[#166534] border-[#16a34a]/30',
  hurry: 'bg-amber-100 text-amber-800 border-amber-500/30',
  unreachable: 'bg-red-100 text-red-800 border-red-500/30',
};

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export function AssistantAnswerCard({
  answer,
  onSelectCandidate,
  onAskArrivalsAt,
  onOpenTripOnMap,
  onRepickDestination,
  className,
}: AssistantAnswerCardProps) {
  const router = useRouter();

  /** §3: el toque en el viaje cierra la hoja (el padre la pasa a idle) y navega. */
  const openTrip = (trip: TripOption, origin: LocationPoint, boardingStopId?: string, arrival?: EstimacionLlegada) => {
    if (onOpenTripOnMap) {
      onOpenTripOnMap(trip, origin, boardingStopId, arrival);
      return;
    }
    router.push(tripMapUrl(trip, origin, { boardingStopId, arrival }));
  };

  /** Tocar una línea de la lista de llegadas: al mapa con parada + línea enfocadas. */
  const openArrivalOnMap = (paradaId: string, lineaId: string) => {
    router.push(`/mapas?parada=${encodeURIComponent(paradaId)}&linea=${encodeURIComponent(lineaId)}`);
  };

  return (
    <section
      aria-live="polite"
      className={cn(
        'bg-canvas rounded-2xl border border-hairline shadow-sm p-4 flex flex-col gap-3',
        className,
      )}
    >
      <header className="flex items-start gap-2">
        <span className="mt-0.5 w-7 h-7 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center shrink-0">
          {answer.kind === 'nearby-stops' ? (
            <MapPin className="w-4 h-4 text-ink" />
          ) : answer.kind === 'trip' || answer.kind === 'walk-timing' || answer.kind === 'trip-guide' ? (
            <Navigation className="w-4 h-4 text-ink" />
          ) : (
            <Clock className="w-4 h-4 text-ink" />
          )}
        </span>
        <h3 className="text-base font-bold text-ink leading-snug">{answer.headline}</h3>
      </header>

      {answer.kind === 'arrivals' && (
        <ul className="flex flex-col gap-1.5">
          {answer.arrivals.map((a, i) => (
            <li key={`${a.lineaNumero}-${a.interno}-${i}`}>
              <button
                type="button"
                onClick={() => openArrivalOnMap(answer.parada.id, a.lineaId)}
                title={`Ver la línea ${a.lineaNumero} en el mapa`}
                aria-label={`Ver la línea ${a.lineaNumero} (${a.ramal}) en el mapa, cerca de ${answer.parada.nombre}`}
                className="w-full text-left flex items-center justify-between gap-2 bg-canvas-soft hover:bg-field border border-hairline-soft rounded-lg px-3 py-2.5 min-h-[48px] transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LineBadge shortName={a.lineaNumero} color={a.colorHex} size="sm" />
                  <span className="text-sm text-ink font-semibold truncate">{a.ramal}</span>
                </div>
                <span className="text-sm font-bold text-[#16a34a] shrink-0">
                  {a.displayLabel ?? (a.minutos === 0 ? 'Llega' : `${a.minutos} min`)}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => router.push(`/parada/${answer.parada.id}`)}
              className="w-full h-10 text-sm font-semibold text-ink hover:bg-canvas-soft rounded-lg transition-colors inline-flex items-center justify-center gap-1"
            >
              Ver todas las llegadas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </li>
        </ul>
      )}

      {answer.kind === 'nearby-stops' && (
        <ul className="flex flex-col gap-1.5">
          {answer.stops.map(({ parada, distanceMeters, walkMinutes }) => (
            <li
              key={parada.id}
              className="flex items-center justify-between gap-2 bg-canvas-soft border border-hairline-soft rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">{parada.nombre}</p>
                <p className="text-xs text-text-muted">
                  {formatDistance(distanceMeters)} · caminando ~{walkMinutes} min
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onAskArrivalsAt && (
                  <button
                    type="button"
                    onClick={() => onAskArrivalsAt(parada.id)}
                    className="h-8 px-2.5 rounded-full bg-canvas border border-hairline text-xs font-semibold text-ink hover:bg-field transition-colors"
                    aria-label={`Consultar llegadas en ${parada.nombre}`}
                  >
                    ¿Cuándo llega?
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/mapas?parada=${encodeURIComponent(parada.id)}`)}
                  className="h-8 w-8 rounded-full bg-canvas border border-hairline flex items-center justify-center text-text-muted hover:text-ink hover:bg-field transition-colors"
                  aria-label={`Ver ${parada.nombre} en el mapa`}
                  title="Ver en el mapa"
                >
                  <MapPin className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/parada/${parada.id}`)}
                  className="h-8 w-8 rounded-full bg-canvas border border-hairline flex items-center justify-center text-text-muted hover:text-ink hover:bg-field transition-colors"
                  aria-label={`Abrir parada ${parada.nombre}`}
                  title="Ver todas las llegadas"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {answer.kind === 'trip' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {answer.trip.linesInvolved.map((chip) => (
              <LineBadge key={chip.id} shortName={chip.numero} color={chip.color} size="sm" />
            ))}
            <span className="text-xs text-text-muted">
              {answer.trip.transfersCount === 0
                ? 'sin transbordos'
                : `${answer.trip.transfersCount} transbordo${answer.trip.transfersCount > 1 ? 's' : ''}`}
              {' · '}caminás ~{answer.trip.walkDurationMinutes} min
            </span>
          </div>
          <p className="text-sm text-text-muted leading-snug">{answer.trip.title}</p>
          <button
            type="button"
            onClick={() => openTrip(answer.trip, answer.origin)}
            className="w-full h-11 bg-ink text-canvas rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Navigation className="w-4 h-4" /> Ver el viaje completo en el mapa
          </button>
        </div>
      )}

      {answer.kind === 'trip-guide' && (
        <div className="flex flex-col gap-3">
          {/* Origen → destino */}
          <div className="flex items-center gap-2 text-xs text-text-muted min-w-0">
            <span className="w-2 h-2 rounded-full bg-electric-blue shrink-0" aria-hidden />
            <span className="font-semibold text-ink truncate">{answer.originStop.nombre}</span>
            <ArrowRight className="w-3 h-3 shrink-0" aria-hidden />
            <span className="font-semibold text-ink truncate">{answer.destination.name}</span>
          </div>

          {answer.trip ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {answer.trip.linesInvolved.map((chip) => (
                  <LineBadge key={chip.id} shortName={chip.numero} color={chip.color} size="sm" />
                ))}
                <span className="text-xs text-text-muted">
                  {answer.trip.transfersCount === 0
                    ? 'sin transbordos'
                    : `${answer.trip.transfersCount} transbordo${answer.trip.transfersCount > 1 ? 's' : ''}`}
                  {' · '}~{answer.trip.totalDurationMinutes} min total
                </span>
              </div>
              <p className="text-sm text-text-muted leading-snug">{answer.trip.title}</p>
            </>
          ) : (
            <p className="text-xs text-text-muted">
              No hay combinación sobre la red Metropol hasta ese destino, pero en esta parada pasan:
            </p>
          )}

          {answer.arrivals.length > 0 && (
            <p className="text-xs font-semibold text-text-muted">Elegí el colectivo que vas a tomar</p>
          )}
          {/* sdd/trip-options-upgrade 2.5: zero-bus — copy + re-pick, sin botones de bondi. */}
          {answer.arrivals.length === 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-hairline-soft bg-canvas-soft px-3 py-2.5">
              <p className="text-xs font-semibold text-ink">
                Por ahora no hay colectivos en vivo en {answer.originStop.nombre}.
              </p>
              <p className="text-xs text-text-muted leading-snug">
                Probá con otro destino sobre los corredores 65, 194 o la línea simulada 60.
              </p>
              {onRepickDestination && (
                <button
                  type="button"
                  onClick={onRepickDestination}
                  className="h-9 rounded-xl bg-ink text-canvas text-xs font-bold active:scale-[0.98] transition-transform"
                >
                  Elegir otro destino
                </button>
              )}
            </div>
          )}
          {answer.arrivals.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {answer.arrivals.map((a, i) => (
                <li key={`${a.lineaNumero}-${a.interno}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (answer.trip) {
                        openTrip(answer.trip, {
                          name: answer.originStop.nombre,
                          lat: answer.originStop.lat,
                          lng: answer.originStop.lng,
                          stopId: answer.originStop.id,
                        }, answer.originStop.id, a);
                      } else {
                        openArrivalOnMap(answer.originStop.id, a.lineaId);
                      }
                    }}
                    title={answer.trip ? `Elegir el ${a.lineaNumero} que llega ${a.displayLabel ?? `${a.minutos} min`}` : `Ver la línea ${a.lineaNumero} en el mapa`}
                    aria-label={answer.trip ? `Elegir el colectivo ${a.lineaNumero}, llega ${a.displayLabel ?? `${a.minutos} min`}` : `Ver la línea ${a.lineaNumero} (${a.ramal}) en el mapa, en ${answer.originStop.nombre}`}
                    className="w-full text-left flex items-center justify-between gap-2 bg-canvas-soft hover:bg-field border border-hairline-soft rounded-lg px-3 py-2.5 min-h-[48px] transition-colors active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LineBadge shortName={a.lineaNumero} color={a.colorHex} size="sm" />
                      <span className="text-sm text-ink font-semibold truncate">{a.ramal}</span>
                    </div>
                    <span className="text-sm font-bold text-[#16a34a] shrink-0">
                      {a.displayLabel ?? (a.minutos === 0 ? 'Llega' : `${a.minutos} min`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {answer.trip && (
            <button
              type="button"
              onClick={() =>
                openTrip(answer.trip as TripOption, {
                  name: answer.originStop.nombre,
                  lat: answer.originStop.lat,
                  lng: answer.originStop.lng,
                  stopId: answer.originStop.id,
                })
              }
              className="w-full h-11 bg-ink text-canvas rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Navigation className="w-4 h-4" /> Ver el viaje completo en el mapa
            </button>
          )}
        </div>
      )}

      {answer.kind === 'walk-timing' && (
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              'rounded-xl border px-4 py-3 flex items-center justify-between',
              FEASIBILITY_STYLE[answer.feasibility.status] ?? FEASIBILITY_STYLE['on-time'],
            )}
          >
            <span className="text-lg font-extrabold">{answer.feasibility.label}</span>
            <span className="text-sm font-semibold">
              {answer.feasibility.walkMin} min a pie · bondi en {answer.arrival.minutos} min
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Parada {answer.parada.nombre} · línea {answer.arrival.lineaNumero} ({answer.arrival.ramal})
          </p>
        </div>
      )}

      {answer.kind === 'clarify' && answer.candidates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {answer.candidates.map((c, i) => (
            <button
              key={`${c.name}-${i}`}
              type="button"
              onClick={() => onSelectCandidate?.(c)}
              className="text-left bg-canvas-soft hover:bg-field border border-hairline-soft rounded-lg px-3 py-2 transition-colors"
            >
              <p className="text-sm font-bold text-ink truncate">{c.name}</p>
              {c.address && <p className="text-xs text-text-muted truncate">{c.address}</p>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
