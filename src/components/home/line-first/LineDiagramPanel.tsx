"use client";

import { LineSchematic } from "@/components/diagrama/LineSchematic";
import type { LineFirstContext } from "@/lib/home/line-first";
import type { EstimacionLlegada } from "@/types/transport";

interface LineDiagramPanelProps {
  context: LineFirstContext;
  arrival?: EstimacionLlegada;
  onOpenStopPicker: () => void;
}

function arrivalLabel(arrival?: EstimacionLlegada): string | undefined {
  if (!arrival) return undefined;
  if (arrival.displayStatus === "en-parada" || arrival.minutos === 0)
    return "En la parada";
  if (arrival.displayStatus === "arribando") return "Llegando";
  return `Llega en ${arrival.minutos} min`;
}

/** Home-sized diagram panel sharing the exact map slot contract. */
export function LineDiagramPanel({
  context,
  arrival,
  onOpenStopPicker,
}: LineDiagramPanelProps) {
  const { line, recorrido, stops, stop } = context;
  const origin = recorrido.destino
    ? `${recorrido.origen} hacia ${recorrido.destino}`
    : recorrido.origen;

  return (
    <div className="home-rise h-full overflow-hidden rounded-3xl border border-hairline bg-[#121418]">
      <LineSchematic
        origin={origin}
        eta={arrivalLabel(arrival)}
        color={line.color}
        stops={stops.map((routeStop, index) => ({
          id: routeStop.id,
          nombre: routeStop.nombre,
          tipo:
            index === 0 || index === stops.length - 1 ? "CABECERA" : undefined,
        }))}
        highlightStopId={stop.id}
        onOpenStopPicker={onOpenStopPicker}
        className="h-full"
      />
    </div>
  );
}
