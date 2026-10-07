import { Footprints, GitBranch, MapPin, Train, TramFront } from 'lucide-react';
import { LineBadge } from '@/components/ui/line-badge';
import { combinacionesDeParada } from '@/lib/combinaciones';
import type { Parada } from '@/types/transport';
import type { TransitLeg, TripOption } from '@/types/trip-planner';

interface TripDiagramProps {
  option: TripOption;
}

/**
 * Nodo plano del diagrama: el recorrido se modela como una lista única de
 * puntos (origen → caminatas → paradas de cada tramo → combinaciones →
 * destino) para que el rail coloreado conecte paradas del MISMO tramo.
 */
type DiagramNode =
  | { kind: 'origin' | 'destination'; key: string; name: string }
  | { kind: 'walk'; key: string; distanceMeters: number; durationMinutes: number }
  | { kind: 'transfer'; key: string; walkingDistanceMeters: number }
  | {
      kind: 'stop';
      key: string;
      stop: Parada;
      leg: TransitLeg;
      tag?: 'Subís' | 'Bajás';
      isBoarding: boolean;
    };

function buildNodes(option: TripOption): DiagramNode[] {
  const nodes: DiagramNode[] = [
    { kind: 'origin', key: 'origin', name: option.origin.name },
  ];
  option.legs.forEach((leg, legIndex) => {
    if (leg.type === 'walk') {
      nodes.push({
        kind: 'walk',
        key: `walk-${legIndex}`,
        distanceMeters: leg.distanceMeters,
        durationMinutes: leg.durationMinutes,
      });
      return;
    }
    if (leg.type === 'transfer') {
      nodes.push({
        kind: 'transfer',
        key: `transfer-${legIndex}`,
        walkingDistanceMeters: leg.walkingDistanceMeters,
      });
      return;
    }
    // Tramos de 2 combinaciones llegan con intermediateStops vacío:
    // el fallback mantiene al menos subida + bajada.
    const stops = leg.intermediateStops.length > 0
      ? leg.intermediateStops
      : [leg.fromStop, leg.toStop];
    stops.forEach((stop, stopIndex) => {
      nodes.push({
        kind: 'stop',
        key: `ride-${legIndex}-${stop.id}-${stopIndex}`,
        stop,
        leg,
        tag:
          stopIndex === 0
            ? 'Subís'
            : stopIndex === stops.length - 1
              ? 'Bajás'
              : undefined,
        isBoarding: stopIndex === 0,
      });
    });
  });
  nodes.push({ kind: 'destination', key: 'destination', name: option.destination.name });
  return nodes;
}

/** Conector desde un nodo al siguiente: sólido del color de la línea solo
 *  entre paradas del mismo tramo; punteado (a pie / combinación) en el resto. */
function connectorBetween(
  current: DiagramNode,
  next: DiagramNode | undefined,
): { color: string | null } | null {
  if (!next) return null;
  if (current.kind === 'stop' && next.kind === 'stop' && next.leg === current.leg) {
    return { color: current.leg.lineaColor };
  }
  return { color: null };
}

function nodeTitle(node: DiagramNode): string {
  switch (node.kind) {
    case 'origin':
    case 'destination':
      return node.name;
    case 'walk':
      return `Caminá ${node.distanceMeters} m${node.durationMinutes > 0 ? ` · ${node.durationMinutes} min` : ''}`;
    case 'transfer':
      return node.walkingDistanceMeters > 15
        ? `Combinación · caminá ${node.walkingDistanceMeters} m`
        : 'Combinación';
    case 'stop':
      return node.stop.nombre;
  }
}

function NodeIcon({ node }: { node: DiagramNode }) {
  const base =
    'absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-canvas';
  switch (node.kind) {
    case 'origin':
      return (
        <span className={`${base} bg-canvas-soft border border-hairline`} aria-hidden="true">
          <MapPin className="h-3.5 w-3.5 text-ink" />
        </span>
      );
    case 'destination':
      return (
        <span className={`${base} bg-ink`} aria-hidden="true">
          <MapPin className="h-3.5 w-3.5 text-canvas" />
        </span>
      );
    case 'walk':
      return (
        <span className={`${base} bg-canvas-soft border border-hairline`} aria-hidden="true">
          <Footprints className="h-3.5 w-3.5 text-text-muted" />
        </span>
      );
    case 'transfer':
      return (
        <span className={`${base} border border-amber-500/40 bg-amber-100`} aria-hidden="true">
          <GitBranch className="h-3.5 w-3.5 text-amber-800" />
        </span>
      );
    case 'stop':
      return (
        <span className={base} style={{ backgroundColor: node.leg.lineaColor }} aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-canvas" />
        </span>
      );
  }
}

/**
 * TripDiagram — recorrido esquemático tipo subte de la alternativa ELEGIDA.
 * Dibuja los legs de `option` en orden: caminatas punteadas, tramos con el
 * rail en el color de la línea, nodos de combinación y origen/destino.
 * Nunca muestra internos/unidades; los nombres envuelven, no truncan.
 */
export function TripDiagram({ option }: TripDiagramProps) {
  const nodes = buildNodes(option);
  return (
    <ol aria-label="Paradas del recorrido" className="space-y-0">
      {nodes.map((node, index) => {
        const connector = connectorBetween(node, nodes[index + 1]);
        const combinaciones = node.kind === 'stop' ? combinacionesDeParada(node.stop.nombre) : [];
        return (
          <li key={node.key} className="relative pl-9 pb-5 last:pb-0">
            {connector ? (
              connector.color ? (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 -bottom-2 w-1 rounded-full"
                  style={{ backgroundColor: connector.color }}
                />
              ) : (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-6 -bottom-2 border-l-2 border-dashed border-hairline"
                />
              )
            ) : null}
            <NodeIcon node={node} />
            <div className="flex min-w-0 flex-col gap-1.5">
              {node.kind === 'stop' && node.isBoarding ? (
                <div className="flex items-center gap-2">
                  <LineBadge shortName={node.leg.lineaNumero} color={node.leg.lineaColor} size="sm" />
                  <p className="min-w-0 break-words text-xs font-semibold text-text-muted">
                    Hacia {node.leg.ramalNombre}
                    {node.leg.stopCount > 0
                      ? ` · ${node.leg.stopCount} parada${node.leg.stopCount === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
              ) : null}
              <p className="break-words text-sm font-semibold leading-tight text-ink">
                {nodeTitle(node)}
                {node.kind === 'origin' ? (
                  <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Origen</span>
                ) : null}
                {node.kind === 'destination' ? (
                  <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">Destino</span>
                ) : null}
                {node.kind === 'stop' && node.tag ? (
                  <span className="ml-1.5 text-[10px] font-bold uppercase text-text-muted">{node.tag}</span>
                ) : null}
              </p>
              {combinaciones.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {combinaciones.map((c) => {
                    const Icon = c.mode === 'tren' ? Train : TramFront;
                    return (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-canvas"
                        style={{ backgroundColor: c.color }}
                        title={`Combinación con ${c.label}`}
                      >
                        <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                        {c.label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
