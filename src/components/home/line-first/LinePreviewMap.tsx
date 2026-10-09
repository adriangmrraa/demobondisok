'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DynamicMap from '@/components/map/DynamicMap';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import type { MapFocusRequest } from '@/components/map/MapCanvas';
import type { VehiclePosition } from '@/lib/data-service';

interface LinePreviewMapProps {
  recorridoId: string;
  stop: { id: string; lat: number; lng: number };
  color: string;
  positions: VehiclePosition[];
  bounds: [[number, number], [number, number]];
  href: string;
  ariaLabel: string;
  className?: string;
}

const PREVIEW_PADDING = { top: 28, bottom: 28, left: 28, right: 28 };

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * Mapa embebido del Home (docs/HOME-LINEA-FIRST.md §4.3): el mismo MapCanvas
 * de /mapas, sin interacción. Un overlay transparente lleva al mapa en vivo
 * con la línea y la parada ya elegidas.
 */
export function LinePreviewMap({
  recorridoId,
  stop,
  color,
  positions,
  bounds,
  href,
  ariaLabel,
  className,
}: LinePreviewMapProps) {
  const { resolvedTheme } = useTheme();
  // El encuadre se re-pide al quedar listo el mapa y en cada cambio de selección.
  const [readyCount, setReadyCount] = useState(0);
  const highlightLines = useMemo(() => [recorridoId], [recorridoId]);
  const focusRequest = useMemo<MapFocusRequest>(
    () => ({
      bounds,
      nonce: hashKey(`${recorridoId}|${stop.id}|${readyCount}`),
      padding: PREVIEW_PADDING,
      pitch: 0,
      bearing: 0,
      maxZoom: 15.5,
    }),
    [bounds, recorridoId, stop.id, readyCount],
  );
  const pulse = useMemo(() => ({ lat: stop.lat, lng: stop.lng, color }), [stop.lat, stop.lng, color]);

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-2xl border border-hairline bg-canvas-soft',
        '[&_.maplibregl-ctrl-top-right]:hidden! [&_.maplibregl-ctrl-bottom-left]:hidden!',
        className,
      )}
    >
      <DynamicMap
        positions={positions}
        highlightLines={highlightLines}
        cameraMode="free"
        entryAnimation={false}
        focusRequest={focusRequest}
        plannerPulse={pulse}
        theme={resolvedTheme}
        unavailableHref={href}
        unavailableLabel="Abrir el mapa en vivo"
        onMapReady={() => setReadyCount((count) => count + 1)}
        className="h-full w-full"
      />
      <Link href={href} aria-label={ariaLabel} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-blue" />
    </div>
  );
}
