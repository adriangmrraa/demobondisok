'use client';

import { useRouter } from 'next/navigation';
import type { KeyboardEvent } from 'react';
import { Bus, Train } from 'lucide-react';
import type { Combinacion } from '@/lib/combinaciones';
import type {
  LabelSide,
  NetworkSchematic,
  SchematicInterchange,
  SchematicLine,
  SchematicNode,
} from '@/lib/diagrama-red';

/**
 * Plano esquemático de la red (estilo plano de subte).
 *
 * Cada línea se dibuja como un trazo SVG con nodos de paradas destacadas,
 * cabeceras marcadas, chips de combinación (subte/tren/metrobus) y la
 * capsule de intercambio donde los trazos se encuentran.
 * El trazo completo es tappeable (área invisible de 34px) y navega al
 * detalle `/diagrama/[lineId]`; también es focuseable por teclado
 * (role="link" + Enter/Espacio).
 */

interface NetworkSchematicProps {
  diagram: NetworkSchematic;
}

const LABEL_DX = 11;
const CHIP = 11;
const CHIP_GAP = 2.5;

/** Fila de chips de combinación anclada al label (subte=letra, tren/metrobus=ícono). */
function ConexionChips({
  x,
  y,
  side,
  conexiones,
}: {
  x: number;
  y: number;
  side: LabelSide;
  conexiones: Combinacion[];
}) {
  if (conexiones.length === 0) return null;
  const width = conexiones.length * CHIP + (conexiones.length - 1) * CHIP_GAP;
  const startX = side === 'left' ? x - width : x;
  return (
    <g aria-hidden="true">
      {conexiones.map((c, i) => {
        const cx = startX + i * (CHIP + CHIP_GAP);
        const letter = c.mode === 'subte' ? c.label.replace('Subte ', '') : null;
        return (
          <g key={`${c.id}-${i}`} transform={`translate(${cx} ${y})`}>
            <rect width={CHIP} height={CHIP} rx={2.5} fill={c.color} />
            {letter ? (
              <text
                x={CHIP / 2}
                y={CHIP / 2 + 2.4}
                textAnchor="middle"
                fill="#FFFFFF"
                style={{ fontSize: 6.8, fontWeight: 900 }}
              >
                {letter}
              </text>
            ) : c.mode === 'tren' ? (
              <Train x={2} y={2} width={CHIP - 4} height={CHIP - 4} color="#FFFFFF" strokeWidth={2.6} />
            ) : (
              <Bus x={2} y={2} width={CHIP - 4} height={CHIP - 4} color="#FFFFFF" strokeWidth={2.6} />
            )}
          </g>
        );
      })}
    </g>
  );
}

function NodeLabel({ node }: { node: SchematicNode }) {
  const { x, y, nombre, labelSide: side, conexiones, isCabecera } = node;
  const anchor = side === 'left' ? 'end' : 'start';
  const tx = side === 'left' ? x - LABEL_DX : x + LABEL_DX;
  return (
    <g aria-hidden="true">
      <text
        x={tx}
        y={y + 3}
        textAnchor={anchor}
        className="fill-ink"
        style={{ fontSize: isCabecera ? 10.5 : 9.5, fontWeight: isCabecera ? 800 : 600 }}
      >
        {nombre}
      </text>
      <ConexionChips x={tx} y={y + 6.5} side={side} conexiones={conexiones} />
      {isCabecera ? (
        <text
          x={tx}
          y={y + (conexiones.length > 0 ? 22 : 15)}
          textAnchor={anchor}
          className="fill-text-muted"
          style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.1em' }}
        >
          CABECERA
        </text>
      ) : null}
    </g>
  );
}

function SchematicLineGroup({
  line,
  onNavigate,
}: {
  line: SchematicLine;
  onNavigate: (lineId: string) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNavigate(line.lineId);
    }
  };
  return (
    <g
      role="link"
      tabIndex={0}
      aria-label={`Ver el esquema de la línea ${line.numero}`}
      className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ink"
      onClick={() => onNavigate(line.lineId)}
      onKeyDown={handleKeyDown}
    >
      {/* Halo + trazo principal + área de tap */}
      <path
        d={line.pathD}
        fill="none"
        stroke={line.color}
        strokeWidth={12}
        strokeLinecap="round"
        opacity={0.16}
        aria-hidden="true"
      />
      <path
        d={line.pathD}
        fill="none"
        stroke={line.color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      />
      <path
        d={line.pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={34}
        strokeLinecap="round"
        aria-hidden="true"
      />

      {/* Nodos: cabeceras llenas, paradas con combinación en capsule, resto puntos */}
      {line.nodes.map((node) =>
        node.isCabecera ? (
          <g key={node.stopId}>
            <circle
              cx={node.x}
              cy={node.y}
              r={6.5}
              fill={line.color}
              strokeWidth={2.5}
              className="stroke-canvas"
            />
            <circle cx={node.x} cy={node.y} r={2} className="fill-canvas" aria-hidden="true" />
            <NodeLabel node={node} />
          </g>
        ) : (
          <g key={node.stopId}>
            {node.conexiones.length > 0 ? (
              <rect
                x={node.x - 7}
                y={node.y - 5}
                width={14}
                height={10}
                rx={5}
                stroke={line.color}
                strokeWidth={2.5}
                className="fill-canvas"
              />
            ) : (
              <circle
                cx={node.x}
                cy={node.y}
                r={3.5}
                stroke={line.color}
                strokeWidth={2.5}
                className="fill-canvas"
              />
            )}
            <NodeLabel node={node} />
          </g>
        ),
      )}

      {/* Chip del número de línea */}
      <g transform={`translate(${line.chipPoint.x} ${line.chipPoint.y})`} aria-hidden="true">
        <rect
          x={-19}
          y={-11}
          width={38}
          height={22}
          rx={11}
          fill={line.color}
          strokeWidth={2.5}
          className="stroke-canvas"
        />
        <text
          textAnchor="middle"
          dy={4}
          fill={line.textColor}
          style={{ fontSize: 11.5, fontWeight: 900 }}
        >
          {line.numero}
        </text>
      </g>
    </g>
  );
}

function InterchangeStation({ ic }: { ic: SchematicInterchange }) {
  const anchor = ic.labelSide === 'left' ? 'end' : 'start';
  const tx = ic.labelSide === 'left' ? ic.x - LABEL_DX - 4 : ic.x + LABEL_DX + 4;
  return (
    <g>
      <rect
        x={ic.x - 15}
        y={ic.y - 7}
        width={30}
        height={14}
        rx={7}
        strokeWidth={1.5}
        className="fill-canvas stroke-ink"
      />
      {ic.lineaColores.map((color, i) => (
        <circle
          key={color}
          cx={ic.x - 6 + i * 12}
          cy={ic.y}
          r={3.5}
          fill={color}
          aria-hidden="true"
        />
      ))}
      <text
        x={tx}
        y={ic.y - 10}
        textAnchor={anchor}
        className="fill-ink"
        style={{ fontSize: 10.5, fontWeight: 800 }}
        aria-hidden="true"
      >
        {ic.nombre}
      </text>
      <ConexionChips x={tx} y={ic.y - 6} side={ic.labelSide} conexiones={ic.conexiones} />
    </g>
  );
}

export function NetworkSchematicView({ diagram }: NetworkSchematicProps) {
  const router = useRouter();
  const { viewBox, lines, interchanges, zonaDividerY } = diagram;

  const navigate = (lineId: string) => router.push(`/diagrama/${lineId}`);

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Plano esquemático de la red Metropol. Línea 65 de Plaza Constitución a Barrancas de Belgrano; línea 194 de Plaza Miserere a Zárate. Se combinan en Avenida Cabildo y Juramento."
    >
      {/* Divisor esquemático CABA ↔ GBA Norte */}
      <line
        x1={8}
        x2={viewBox.width - 8}
        y1={zonaDividerY}
        y2={zonaDividerY}
        strokeDasharray="4 5"
        strokeWidth={1}
        className="stroke-hairline"
        aria-hidden="true"
      />
      <text
        x={12}
        y={zonaDividerY - 5}
        className="fill-text-faint"
        style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em' }}
        aria-hidden="true"
      >
        GBA NORTE
      </text>
      <text
        x={viewBox.width - 12}
        y={zonaDividerY + 11}
        textAnchor="end"
        className="fill-text-faint"
        style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em' }}
        aria-hidden="true"
      >
        CABA
      </text>

      {lines.map((line) => (
        <SchematicLineGroup key={line.lineId} line={line} onNavigate={navigate} />
      ))}

      {/* Estaciones de intercambio (encima de todos los trazos) */}
      {interchanges.map((ic) => (
        <InterchangeStation key={ic.stopId} ic={ic} />
      ))}
    </svg>
  );
}
