/**
 * MapCanvas — Mapa en vivo con colectivos (RutaBA)
 *
 * Arquitectura profesional:
 * - Vector tiles CARTO Voyager (gratis, sin API key) — nítidos en todo zoom
 * - Buses como SYMBOL LAYER nativo (GeoJSON source): render en GPU
 * - Tres representaciones según escala:
 *     · z < 13.5  → badge upright con número y rumbo desacoplados
 *     · z 13.4–15.6 → colectivo cenital rotado por heading
 *     · z ≥ 14.4 → colectivo isométrico Tipo D, BILLBOARD relativo a la
 *       cámara (rota según heading − bearing en pantalla: no se voltea)
 *       con rig de eje delantero (3 sprites por steer pre-bakeados)
 * - Rutas de línea: SOLO se pintan para las líneas seleccionadas
 *   (highlightLines), con animación de flujo en la ruta activa.
 * - Movimiento suave: dead-reckoning del cliente (LERP 60fps) sobre un
 *   feed limpio de 1Hz.
 * - Selección: onBusSelect + glow blanco bajo la unidad + cámara que
 *   la sigue hasta que el usuario haga un gesto.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Serve the MapLibre worker and its shared module from public/.
// scripts/copy-maplibre-worker.mjs keeps both files version-matched for Next.js.
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}
import type { VehiclePosition } from '@/lib/data-service';
import type { TripSegmentItem } from '@/types/trip-planner';
import { vehicleCameraFrame, type CameraMode } from '@/lib/map/camera-controller';
import { VehicleMotion } from '@/lib/map/vehicle-motion-engine';
import { TransportService } from '@/lib/services/transport-service';
import {
  busBadgeSvg,
  busHeadingSvg,
  busIsoSvg,
  busShadowSvg,
  busTopDownSvg,
  lightenHex,
} from '@/lib/map/vehicle-sprites';
import { isIsoFlipped, isoBillboardRotation, shadowRotation } from '@/lib/map/vehicle-billboard';
import { headingDelta, nextSteerBucket, smoothSteerRate } from '@/lib/map/vehicle-steer';
import { MOCK_ROUTES, MOCK_LINES, MOCK_STOPS, MOCK_LINE_STOPS, RAMAL_COLORS, DATASET } from '@/mock/data';
import {
  URBAN_ICON_TYPES,
  SIGNAL_MIN_ZOOM,
  CROSSING_MIN_ZOOM,
  SIGNAL_TYPES,
  CROSSING_TYPES,
  NAMED_POI_TYPES,
  urbanIconSvg,
  type UrbanFeature,
} from '@/lib/map/urban-features';

type RawPoi = {
  type: string;
  name?: string;
  id?: string;
  osmType?: UrbanFeature['osmType'];
  osmId?: number;
  direction?: string;
  lat: number;
  lng: number;
};

/** Petición de encuadre (Fase 3): el nonce re-dispara el fitBounds. */
export interface MapFocusRequest {
  bounds: [[number, number], [number, number]];
  nonce: number;
  /** Aire inferior para que el sheet no tape el viaje. */
  bottomPadding?: number;
  /** Inclinación a forzar en el fitBounds (3D=52, 2D=0). */
  pitch?: number;
  /** Rumbo a forzar en el fitBounds; sin él MapLibre resetea al norte. */
  bearing?: number;
  /** Techo de zoom para que un segmento corto no sobre-zoomee. */
  maxZoom?: number;
}

/** Borrador del planner (Fase 4): marcadores de origen y destino. */
export interface PlannerMapPoints {
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
}

/** Parada más cercana al destino: punto con PULSO animado en el mapa. */
export interface PlannerMapPulse {
  lat: number;
  lng: number;
  /** Color de la línea de la parada (o primario si no tiene). */
  color?: string;
}

function normalizePoi(p: RawPoi): UrbanFeature {
  // v1 usaba type 'church' → v2 'place_of_worship'
  const type = p.type === 'church' ? 'place_of_worship' : p.type;
  return { ...p, type } as UrbanFeature;
}

/**
 * Snapshot v2 (scripts/fetch-pois.mjs): señalización y POIs OSM reales
 * filtrados por corredor, servido desde public/data — FUERA del bundle
 * y cacheable por el service worker. `name` es OPCIONAL (los semáforos
 * no tienen). Promesa cacheada: se baja una sola vez por sesión.
 * Si la red falla, el mapa sigue vivo sin las capas urbanas.
 */
let poisPromise: Promise<UrbanFeature[]> | null = null;
function loadUrbanFeatures(): Promise<UrbanFeature[]> {
  if (!poisPromise) {
    poisPromise = fetch('/data/pois.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { pois?: RawPoi[] }) => (data.pois ?? []).map(normalizePoi))
      .catch((err: unknown) => {
        poisPromise = null; // no envenenar la caché: reintento al próximo mount
        console.warn('pois.json no disponible:', err instanceof Error ? err.message : err);
        return [] as UrbanFeature[];
      });
  }
  return poisPromise;
}

interface MapPointFeatureLike {
  properties: { [key: string]: string | number | undefined } | null;
}

interface UserLocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface MapCanvasProps {
  positions: VehiclePosition[];
  highlightLines?: string[];
  onBusSelect?: (pos: VehiclePosition | null) => void;
  onStopSelect?: (stopId: string) => void;
  selectedStopId?: string | null;
  /** Re-dispara el flyTo a la parada aunque selectedStopId no cambie. */
  stopFocusNonce?: number;
  selectedKey?: string | null;
  cameraMode?: CameraMode;
  cameraBottomPadding?: number;
  /** Viaje en 3D: la cámara dual bondi+parada usa pitch/bearing. */
  trip3D?: boolean;
  onCameraModeChange?: (mode: CameraMode) => void;
  center?: [number, number];
  theme?: 'light' | 'dark';
  userLocation?: UserLocationPoint | null;
  /** El sheet expandido tapa el mapa → pausa el pulso (spec #861) */
  routePulsePaused?: boolean;
  /** Runs a light pulse over the ride leg while the user is onboard. */
  tripPulseActive?: boolean;
  /** Modo "elegir en el mapa" del planificador: el próximo tap fija un punto. */
  pickMode?: boolean;
  onMapPick?: (lngLat: [number, number]) => void;
  /** Encuadre pedido por el planner (Planifica tu viaje, Fase 3). */
  focusRequest?: MapFocusRequest | null;
  /** Borrador del planner: pin de origen y de llegada (Fase 4). */
  plannerPoints?: PlannerMapPoints | null;
  /** Parada más cercana al destino: anillo con pulso animado. */
  plannerPulse?: PlannerMapPulse | null;
  /** Tramos geométricos recortados exactos del viaje seleccionado en modo Viaje */
  tripSegments?: TripSegmentItem[] | null;
  /** IDs de las paradas utilizadas en el viaje activo para aislar en el mapa */
  tripUsedStopIds?: string[] | null;
  /** Modo foco: conserva la unidad elegida, y deja visibles solo el viaje y sus paradas. */
  tripFocus?: boolean;
  /** Parada de abordaje para el modo 'follow-trip': la cámara encuadra bondi + parada juntos. */
  followTripStop?: { lat: number; lng: number } | null;
  className?: string;
}

/**
 * Capas que se ocultan en modo foco (trip seleccionado).
 * Quedan visibles: trip-seg-*, planner-*, buildings3d, user-*, basemap.
 */
const TRIP_FOCUS_HIDDEN_LAYERS = [
  'route-arrows', 'route-casing', 'route-flow-head', 'route-flow-tail',
  'route-halo-a', 'route-halo-b', 'route-line',
  'route-stops', 'route-stops-label', 'stops',
  'poi-icons', 'poi-labels', 'signal-icons', 'crossing-icons',
];
// NOTA: las paradas genéricas se ocultan en foco; en su lugar se muestra
// la capa 'trip-used-stops' con roles (subida/transbordo/bajada) + etiquetas.

/** Color por rol de parada en el trip (mismo lenguaje que statusColor). */
const TRIP_STOP_ROLE_COLOR: Record<string, string> = {
  board: '#10B981',
  transfer: '#F59E0B',
  alight: '#EF4444',
};

const LINE_COLORS: Record<string, string> = Object.fromEntries(
  MOCK_LINES.map((l) => [l.id, l.color]),
);

/** Estela de la corriente por línea (color de línea aclarado) */
const LINE_COLOR_LIGHT: Record<string, string> = Object.fromEntries(
  MOCK_LINES.map((l) => [l.id, lightenHex(l.color)]),
);

const LINE_SHORT: Record<string, string> = Object.fromEntries(
  MOCK_LINES.map((l) => [l.id, l.shortName]),
);

/**
 * Paradas sintéticas cada ~400m sobre cada recorrido (estilo Moovit/SUBE).
 * El nombre se resuelve contra MOCK_STOPS si hay una esquina conocida a
 * menos de 250m; si no, la parada queda sin etiqueta (solo punto).
 */
interface RouteStop { lineId: string; name: string; lng: number; lat: number }

const ROUTE_STOPS: RouteStop[] = MOCK_STOPS.flatMap((s) =>
  s.lineIds.map((lineId) => ({
    lineId,
    name: s.name,
    lng: s.lng,
    lat: s.lat,
  }))
);

/**
 * Proveedor de tiles vectoriales: CARTO (gratis, sin API key).
 * Nota: se evaluó OpenFreeMap (2026-09-04) y su snapshot actual devuelve
 * tiles vacíos (0 bytes) para Buenos Aires — verificado con fetch directo.
 * CARTO entrega tiles completos (~132KB para BA z13) y solo exige atribución.
 * El tema oscuro usa Dark Matter (mismo proveedor, mismo source 'carto',
 * misma fuente de edificios 3D) — swap de estilo + reinstalación de capas.
 */
const BASEMAP_LIGHT = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const BASEMAP_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const TICK_MS = 1000;

/**
 * Ajusta el padding de `fitBounds` al tamaño real del canvas. Con el sheet de
 * Viaje expandido el padding pedido puede superar el alto del viewport y
 * MapLibre aborta el encuadre ("Map cannot fit within canvas with the given
 * bounds, padding, and/or offset"), dejando la cámara sin mover: no se aleja al
 * elegir un coche lejano ni se reacomoda al colapsar. Se recorta el fondo/derecha
 * para garantizar siempre un área visible mínima y que el zoom se adapte.
 */
const MIN_FIT_VISIBLE_PX = 88;
function clampFitPadding(
  map: maplibregl.Map,
  desired: { top: number; bottom: number; left: number; right: number },
): { top: number; bottom: number; left: number; right: number } {
  const cw = map.getCanvas().clientWidth || 0;
  const ch = map.getCanvas().clientHeight || 0;
  const top = Math.min(desired.top, Math.max(0, ch - MIN_FIT_VISIBLE_PX));
  const bottom = Math.min(desired.bottom, Math.max(0, ch - top - MIN_FIT_VISIBLE_PX));
  const left = Math.min(desired.left, Math.max(0, cw - MIN_FIT_VISIBLE_PX));
  const right = Math.min(desired.right, Math.max(0, cw - left - MIN_FIT_VISIBLE_PX));
  return { top, bottom, left, right };
}

/**
 * Reloj maestro del pulso de ruta (1800 ms, spec de diseño #861): el
 * breathe del mapa y el dot "en vivo" de la lista comparten período.
 * CLOCK_ORIGIN module-level → la fase arranca en la carga de la página,
 * no por instancia de mapa.
 */
const PULSE_PERIOD_MS = 1800;
const PULSE_ORIGIN = typeof performance !== 'undefined' ? performance.now() : 0;

type Live = { lng: number; lat: number; heading: number; speed: number; timestamp: number };

/**
 * POIs reales de OpenStreetMap (iglesias, supermercados, estaciones):
 * circulito blanco con borde navy y glifo navy — mobiliario discreto
 * que suma realismo sin competir con los colectivos.
 */
function poiIconSvg(type: string): string {
  const glyphs: Record<string, string> = {
    church: '<rect x="42" y="30" width="12" height="36" rx="2" fill="#101D3F"/><path d="M30 66 L48 44 L66 66 Z" fill="#101D3F"/><rect x="46.5" y="16" width="3" height="14" rx="1" fill="#101D3F"/><rect x="42" y="20" width="12" height="3" rx="1" fill="#101D3F"/>',
    supermarket: '<path d="M28 32 L34 32 L40 56 L62 56 L67 40 L36 40" fill="none" stroke="#101D3F" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="43" cy="64" r="4.5" fill="#101D3F"/><circle cx="59" cy="64" r="4.5" fill="#101D3F"/><rect x="46" y="22" width="16" height="8" rx="2" fill="#101D3F"/>',
    station: '<rect x="34" y="20" width="28" height="48" rx="9" fill="#101D3F"/><rect x="39" y="26" width="18" height="10" rx="3" fill="#FFFFFF"/><rect x="39" y="40" width="18" height="10" rx="3" fill="#FFFFFF"/><rect x="39" y="56" width="18" height="6" rx="2" fill="#FDE68A"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
    <circle cx="48" cy="48" r="38" fill="#FFFFFF" stroke="#101D3F" stroke-width="3"/>
    ${glyphs[type] ?? ''}
  </svg>`;
}

/**
 * Flecha de sentido para las rutas resaltadas: chevron blanco con borde
 * navy — legible sobre la línea de color, sobre el casing blanco y en
 * ambos temas. Una sola imagen compartida por todas las líneas (la
 * rotación la resuelve symbol-placement: 'line' según el orden de los
 * coordenadas del recorrido).
 */
function routeArrowSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
    <path d="M30 26 L66 48 L30 70 L38 48 Z" fill="#FFFFFF" stroke="#101D3D" stroke-width="5" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Rasteriza el SVG a ImageData respetando el ASPECT del viewBox: los
 * sprites no cuadrados (isométrico 152×132) ya no se aplastan a 96×96.
 */
function svgToImageData(svg: string, size = 96, height = size): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, size, height);
      resolve(ctx.getImageData(0, 0, size, height));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function createStopPopupCardHtml(
  name: string,
  lineNumbers: string,
  badgeColor: string,
  eta: string,
): string {
  return `
    <div style="padding: 7px 11px; min-width: 165px; font-family: var(--font-inter, Inter), system-ui, sans-serif; background: #ffffff; color: #141414; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.12); cursor: pointer; user-select: none;" title="Hacé clic para cerrar">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
        <div style="font-weight: 700; font-size: 12px; line-height: 1.25; color: #0f172a;">
          ${name}
        </div>
        <span style="font-size: 10px; color: #94a3b8; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: #f1f5f9; flex-shrink: 0;">✕</span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 4px;">
        <span style="font-weight: 650; font-size: 10px; color: ${badgeColor}; display: inline-flex; align-items: center; gap: 4px;">
          <span style="width: 6px; height: 6px; border-radius: 9999px; background: ${badgeColor}; display: inline-block;"></span>
          Línea ${lineNumbers}
        </span>
        <span style="font-weight: 700; font-size: 11px; color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; padding: 1px 7px; border-radius: 9999px;">
          ${eta}
        </span>
      </div>
    </div>
  `;
}

export function MapCanvas({
  positions,
  highlightLines = [],
  onBusSelect,
  onStopSelect,
  selectedStopId = null,
  stopFocusNonce = 0,
  selectedKey = null,
  cameraMode = 'overview',
  // sdd/trip-options-upgrade 3.2: padding dinámico (160 colapsado / 514 expandido).
  // Sin cambio de fitBounds — solo el aire inferior que pide el sheet.
  cameraBottomPadding = 116,
  trip3D = false,
  onCameraModeChange,
  center = [-58.3816, -34.6037],
  theme = 'light',
  userLocation = null,
  routePulsePaused = false,
  tripPulseActive = false,
  pickMode = false,
  onMapPick,
  focusRequest = null,
  plannerPoints = null,
  plannerPulse = null,
  tripSegments = null,
  tripUsedStopIds = null,
  tripFocus = false,
  followTripStop = null,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // prefers-reduced-motion: la corriente se congela y el breathe baja —
  // accesibilidad Y performance en gama baja de una sola vez.
  const prefersReducedMotion = useReducedMotion() ?? false;
  const reduceMotionRef = useRef(prefersReducedMotion);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const positionsRef = useRef(positions);
  const highlightRef = useRef(highlightLines);
  const tripFocusRef = useRef(tripFocus);
  const selectedRef = useRef(selectedKey);
  const selectedStopIdRef = useRef<string | null>(selectedStopId);
  const followTripStopRef = useRef<{ lat: number; lng: number } | null>(followTripStop);
  const cameraModeRef = useRef(cameraMode);
  const cameraBottomPaddingRef = useRef(cameraBottomPadding);
  const trip3DRef = useRef(trip3D);
  const cameraModeHandlerRef = useRef(onCameraModeChange);
  const selectHandlerRef = useRef(onBusSelect);
  const stopSelectHandlerRef = useRef(onStopSelect);
  const stopPopupRef = useRef<maplibregl.Popup | null>(null);
  const themeRef = useRef(theme);
  const ingestRef = useRef<() => void>(() => {});
  const refreshRef = useRef<() => void>(() => {});
  const applyRef = useRef<() => void>(() => {});
  const themeApplyRef = useRef<() => void>(() => {});
  const cameraApplyRef = useRef<() => void>(() => {});
  const userLocationRef = useRef<UserLocationPoint | null>(userLocation);
  const userLocationApplyRef = useRef<() => void>(() => {});
  const pulsePausedRef = useRef<boolean>(routePulsePaused);
  const tripPulseActiveRef = useRef<boolean>(tripPulseActive);
  const pickModeRef = useRef<boolean>(pickMode);
  const pickHandlerRef = useRef(onMapPick);
  const plannerPointsRef = useRef<PlannerMapPoints | null>(plannerPoints);
  const plannerPulseRef = useRef<PlannerMapPulse | null>(plannerPulse);
  const tripSegmentsRef = useRef<TripSegmentItem[] | null>(tripSegments);
  const tripUsedStopIdsRef = useRef<string[] | null>(tripUsedStopIds);
  const plannerApplyRef = useRef<() => void>(() => {});
  const pulseControlRef = useRef<{ start: () => void; stop: () => void; isFocused: () => boolean } | null>(
    null,
  );

  useEffect(() => {
    stopSelectHandlerRef.current = onStopSelect;
  }, [onStopSelect]);

  // Cinemática suave hacia la parada seleccionada + render de etiqueta descartable
  useEffect(() => {
    selectedStopIdRef.current = selectedStopId;
    if (!selectedStopId) {
      if (stopPopupRef.current) {
        stopPopupRef.current.remove();
      }
      return;
    }
    const stop = MOCK_STOPS.find((s) => s.id === selectedStopId) || TransportService.getParadas().find((s) => s.id === selectedStopId);
    const map = mapRef.current;
    if (!map || !stop) return;

    map.flyTo({
      center: [stop.lng, stop.lat],
      zoom: 16.5,
      pitch: 25,
      duration: 1100,
      // Usa el prop directo: el ref se actualiza en otro effect y este corre primero
      padding: { bottom: cameraBottomPadding + 80 },
      essential: true,
    });

    const llegadas = TransportService.getLlegadasPorParada(stop.id, positionsRef.current);
    const prox = llegadas[0];
    const etaText = prox?.displayLabel || 'Cada 5 min';
    const isVuelta = stop.id.includes('stop-65-1') && stop.id !== 'stop-65-01';
    const stopLines = ('lineIds' in stop && stop.lineIds && (stop.lineIds as string[]).length > 0)
      ? (stop.lineIds as string[]).map((id: string) => id.replace('line-', '')).join(', ')
      : (stop.id.startsWith('stop-65') ? '65' : '194');
    const lineBadgeColor = stop.id.startsWith('stop-65')
      ? (isVuelta ? '#EA580C' : '#0284C7')
      : '#16A34A';

    if (!stopPopupRef.current) {
      stopPopupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 14,
        className: 'rutaba-stop-popup',
      });
      stopPopupRef.current.on('close', () => {
        stopSelectHandlerRef.current?.('');
      });
    }

    const stopName = ('name' in stop ? stop.name : (stop as { nombre?: string }).nombre) || 'Parada';

    stopPopupRef.current
      .setLngLat([stop.lng, stop.lat])
      .setHTML(createStopPopupCardHtml(stopName, stopLines, lineBadgeColor, etaText))
      .addTo(map);

    // Clic sobre la etiqueta descarta el popup inmediatamente
    const popupElem = stopPopupRef.current.getElement();
    if (popupElem) {
      popupElem.style.cursor = 'pointer';
      popupElem.onclick = (e) => {
        e.stopPropagation();
        stopPopupRef.current?.remove();
        stopSelectHandlerRef.current?.('');
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStopId, stopFocusNonce, cameraBottomPadding]);

  // Cursor crosshair + refs del handler mientras el planificador espera
  // el tap del mapa (el handler 'click' se registra una sola vez).
  useEffect(() => {
    pickModeRef.current = pickMode;
    pickHandlerRef.current = onMapPick;
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode, onMapPick]);

  // Fase 4: el planner notifica borrador (marcadores) → re-pintar la
  // source y encender/apagar el pulso. Event-driven, sin polling.
  useEffect(() => {
    plannerPointsRef.current = plannerPoints;
    plannerPulseRef.current = plannerPulse;
    tripSegmentsRef.current = tripSegments;
    tripUsedStopIdsRef.current = tripUsedStopIds;
    plannerApplyRef.current();
    applyRef.current();
  }, [plannerPoints, plannerPulse, tripSegments, tripUsedStopIds]);

  // Fase 3: encuadre del viaje planificado — event-driven por nonce,
  // programa el fitBounds UNA vez. rAF: si el nonce cambia en el mismo
  // tick que el mount/seed, evita doble easeTo (parpadeo de cámara).
  useEffect(() => {
    if (!focusRequest) return;
    const raf = requestAnimationFrame(() => {
      const map = mapRef.current;
      if (!map || !focusRequest) return;
      map.fitBounds(focusRequest.bounds, {
        padding: clampFitPadding(map, {
          top: 130,
          bottom: (focusRequest.bottomPadding ?? cameraBottomPadding) + 48,
          left: 60,
          right: 60,
        }),
        duration: 900,
        essential: true,
        ...(focusRequest.pitch !== undefined ? { pitch: focusRequest.pitch } : {}),
        ...(focusRequest.bearing !== undefined ? { bearing: focusRequest.bearing } : {}),
        ...(focusRequest.maxZoom !== undefined ? { maxZoom: focusRequest.maxZoom } : {}),
      });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  useEffect(() => {
    reduceMotionRef.current = prefersReducedMotion;
    pulseControlRef.current?.stop();
    applyRef.current();
  }, [prefersReducedMotion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style: themeRef.current === 'dark' ? BASEMAP_DARK : BASEMAP_LIGHT,
      center,
      zoom: 10.8, // entrada cinematográfica: fitBounds hace zoom-in al AMBA
      attributionControl: { compact: true },
      // Cámara nativa en mobile: panning con inercia suave, pinch-zoom
      // alrededor del centro del gesto (no del viewport) y sin snap
      // sorpresa al norte cuando rotás poco.
      maxPitch: 65,
      bearingSnap: 0,
      dragPan: { linearity: 0.3 },
      touchZoomRotate: { around: 'center' },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    // El GeolocateControl stock quedó reemplazado por el control de dominio
    // "Mi ubicación" (useUserLocation): permiso explícito + estados de
    // error + follow-user. Un solo dueño del flujo de ubicación.
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 96 }), 'bottom-left');
    mapRef.current = map;

    // ResizeObserver → map.resize() SIN guard: si el callback re-dispara
    // el propio resize (o el teclado/búsqueda oscilan el contenedor),
    // entramos en reflow thrashing y el canvas parpadea varios frames.
    // Coalesce en un rAF + solo si el tamaño realmente cambió.
    let lastResizeW = 0;
    let lastResizeH = 0;
    let resizeRafId: number | null = null;
    let layoutRefreshRafId: number | null = null;

    // Safari puede crear el canvas mientras React todavía estabiliza el
    // layout de la ruta. El viewport WebGL es correcto, pero WebKit puede
    // conservar un frame vacío/parcial hasta el próximo repaint. Esperar dos
    // frames (no un timeout) sincroniza el resize con el layout compuesto.
    const refreshCanvasAfterStableLayout = () => {
      if (layoutRefreshRafId !== null) return;
      layoutRefreshRafId = requestAnimationFrame(() => {
        layoutRefreshRafId = requestAnimationFrame(() => {
          layoutRefreshRafId = null;
          if (disposed || !mapRef.current || el.clientWidth === 0 || el.clientHeight === 0) return;
          mapRef.current.resize();
          mapRef.current.triggerRepaint();
        });
      });
    };

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const box = el.getBoundingClientRect();
      if (Math.round(box.width) === lastResizeW && Math.round(box.height) === lastResizeH) {
        return;
      }
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        if (disposed || !mapRef.current) return;
        const b = el.getBoundingClientRect();
        lastResizeW = Math.round(b.width);
        lastResizeH = Math.round(b.height);
        mapRef.current.resize();
        refreshCanvasAfterStableLayout();
      });
    });
    ro.observe(el);

    const onPageShow = () => refreshCanvasAfterStableLayout();
    window.addEventListener('pageshow', onPageShow);

    map.on('error', (e) => {
      console.warn('[MapLibre]', e);
    });

    // Handle para consola del demo (mockup sin secretos en el mapa)
    (window as unknown as { __RUTABA_MAP?: maplibregl.Map }).__RUTABA_MAP = map;

    // ─── Interpolación de movimiento ────────────────────────
    // Un VehicleMotion por vehículo (motor puro, plan §2): interpola,
    // extrapola en corto y reconcilia teleports. currentMap guarda la
    // ÚNICA posición renderizada que consumen símbolo, cámara y trail.
    const motionMap = new Map<string, VehicleMotion>();
    const currentMap = new Map<string, Live>();
    const metaMap = new Map<string, { lineId: string; ramalId?: string; unitId: string; direction?: 'ida' | 'vuelta' }>();
    // Rigging del eje delantero (adaptación del spec Tipo D): la derivada
    // del heading por frame se suaviza y bucketea (−1 | 0 | 1); el bucket
    // elige el sprite iso pre-bakeado vía icon-image (match). Sin writes
    // extra: vive dentro del setData que ya corre por frame.
    const steerRateMap = new Map<string, number>();
    const steerBucketMap = new Map<string, -1 | 0 | 1>();
    const headingByKey = new Map<string, number>();
    let activeKeys = new Set<string>();
    let tickStart = 0;
    let rafId: number | null = null;
    let lastFrameAt = 0;
    let disposed = false;

    // Trail fantasma del seleccionado: cometa de puntos cada 300ms (~5s)
    let trail: Array<[number, number]> = [];
    let trailKey: string | null = null;
    let trailColor = '#101D3D';
    let lastTrailPush = 0;
    const emptyTrail = { type: 'FeatureCollection' as const, features: [] };
    const trailData = () => ({
      type: 'FeatureCollection' as const,
      features: trail.map((c, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: c },
        properties: { age: trail.length - 1 - i, color: trailColor },
      })),
    });

    const buildFeatures = () => {
      const features = [];
      const camBearing = map.getBearing();
      const active = highlightRef.current;
      const hlSet = active && active.length > 0 ? new Set(active) : null;

      for (const [key, pos] of currentMap) {
        const m = metaMap.get(key);
        if (!m) continue;

        // Filtrado estricto por línea o ramal activo
        if (hlSet && !hlSet.has('all')) {
          const isLineMatch = hlSet.has(m.lineId);
          const isRamalMatch = m.ramalId ? hlSet.has(m.ramalId) : false;
          if (!isLineMatch && !isRamalMatch) continue;
        }
        const dirSuffix = m.direction ? `-${m.direction}` : '';
        const steer = steerBucketMap.get(key) ?? 0;
        const flipped = isIsoFlipped(pos.heading, camBearing);
        const prefix = flipped ? 'isoFlip' : 'iso';
        const steerSuffix = steer === -1 ? 'L' : steer === 1 ? 'R' : '';
        const isoIcon = `${prefix}${steerSuffix}-${m.lineId}${dirSuffix}`;

        features.push({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [pos.lng, pos.lat] as [number, number] },
          properties: {
            badge: `badge-${m.lineId}${dirSuffix}`,
            headingIcon: `heading-${m.lineId}${dirSuffix}`,
            topDown: `top-${m.lineId}${dirSuffix}`,
            iso: isoIcon,
            colorLight: m.direction === 'vuelta' ? '#FCA5A5' : m.direction === 'ida' ? '#7DD3FC' : (LINE_COLOR_LIGHT[m.lineId] ?? '#67E8F9'),
            heading: Math.round(pos.heading),
            isoRotate: isoBillboardRotation(pos.heading, camBearing),
            shadowRotate: shadowRotation(pos.heading),
            steer,
            shortName: LINE_SHORT[m.lineId] ?? m.lineId,
            lineId: m.lineId,
            ramalId: m.ramalId,
            unitId: m.unitId,
            selected: selectedRef.current === key ? 1 : 0,
          },
        });
      }
      return { type: 'FeatureCollection' as const, features };
    };

    const refreshVehicles = () => {
      const source = map.getSource('vehicles') as maplibregl.GeoJSONSource | undefined;
      source?.setData(buildFeatures());
    };

    const renderFrame = (now: number) => {
      if (disposed) return;

      // Unidades que dejaron de existir en el feed → fuera del render
      for (const key of [...motionMap.keys()]) {
        if (!activeKeys.has(key)) {
          motionMap.delete(key);
          currentMap.delete(key);
          metaMap.delete(key);
          steerRateMap.delete(key);
          steerBucketMap.delete(key);
          headingByKey.delete(key);
        }
      }

      // El engine produce UNA posición por vehículo; símbolo, cámara,
      // trail y tarjeta consumen la misma muestra (fuente única).
      const clockNow = Date.now();
      // dt real del frame: el steer usa la derivada del heading, así que
      // los gaps del RAF (fin de ventana) degradan el rate por sí solos.
      const dtSec = lastFrameAt > 0 ? Math.min((clockNow - lastFrameAt) / 1000, 1) : 1 / 60;
      lastFrameAt = clockNow;
      for (const key of activeKeys) {
        const fr = motionMap.get(key)?.frame(clockNow);
        if (fr) {
          const prevHeading = headingByKey.get(key);
          if (prevHeading === undefined || fr.jumped) {
            steerRateMap.set(key, 0);
            steerBucketMap.set(key, 0);
          } else {
            const rate = smoothSteerRate(
              steerRateMap.get(key) ?? 0,
              headingDelta(prevHeading, fr.heading),
              dtSec,
            );
            steerRateMap.set(key, rate);
            steerBucketMap.set(key, nextSteerBucket(steerBucketMap.get(key) ?? 0, rate));
          }
          headingByKey.set(key, fr.heading);
          currentMap.set(key, {
            lng: fr.lng,
            lat: fr.lat,
            heading: fr.heading,
            speed: fr.speed,
            timestamp: clockNow,
          });
        } else {
          currentMap.delete(key);
        }
      }

      refreshVehicles();

      // Trail: empuja la posición del seleccionado cada 300ms — cometa
      // que se desvanece. Se resetea si cambia la unidad seleccionada.
      const selKeyNow = selectedRef.current;
      if (selKeyNow !== trailKey) {
        trailKey = selKeyNow;
        trail = [];
        const meta = selKeyNow ? metaMap.get(selKeyNow) : undefined;
        trailColor = meta?.direction === 'vuelta' ? '#EF4444' : meta?.direction === 'ida' ? '#0EA5E9' : (MOCK_LINES.find((l) => l.id === meta?.lineId)?.color ?? '#101D3D');
        lastTrailPush = 0;
      }
      const srcTrail = map.getSource('bus-trail') as maplibregl.GeoJSONSource | undefined;
      if (srcTrail) {
        const cur = selKeyNow ? currentMap.get(selKeyNow) : undefined;
        if (cur && now - lastTrailPush > 300) {
          lastTrailPush = now;
          trail.push([cur.lng, cur.lat]);
          if (trail.length > 16) trail.shift();
          srcTrail.setData(trailData());
        } else if (!cur && trail.length > 0) {
          trail = [];
          srcTrail.setData(emptyTrail);
        }
      }

      // Ventana de animación: tick + presupuesto de dead-reckoning.
      // Con feed a 1 Hz la ventana se renueva en cada tick; con feed
      // muerto el render se frena solo al agotar la extrapolación.
      if (now - tickStart < TICK_MS + 1600) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        rafId = null;
      }
    };

    const ensureRaf = () => {
      if (rafId === null && !disposed) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const ingestPositions = () => {
      const next = positionsRef.current;
      const nextKeys = new Set<string>();
      for (const pos of next) {
        const key = `${pos.lineId}-${pos.unitId}`;
        nextKeys.add(key);
        let motion = motionMap.get(key);
        if (!motion) {
          motion = new VehicleMotion();
          motionMap.set(key, motion);
        }
        motion.push({
          lat: pos.lat,
          lng: pos.lng,
          heading: pos.heading,
          speed: pos.speed,
          timestamp: pos.timestamp,
        });
        metaMap.set(key, { lineId: pos.lineId, ramalId: pos.ramalId, unitId: pos.unitId, direction: pos.direction });
      }
      activeKeys = nextKeys;
      tickStart = performance.now();

      // La cámara consume el MISMO frame renderizado que el símbolo.
      // El look-ahead deja calle visible delante del colectivo y el
      // padding respeta el sheet.
      const selKey = selectedRef.current;
      const mode = cameraModeRef.current;
      // Encuadre dual SIEMPRE que haya parada de abordaje (2D y 3D): el bondi
      // elegido y la parada quedan arriba del modal, con zoom según distancia.
      const tripHasStop = Boolean(followTripStopRef.current);
      if (selKey && (mode === 'follow-trip' || ((mode === 'follow-vehicle' || mode === 'navigation-vehicle') && tripHasStop))) {
        applyFollowTripFrame(TICK_MS + 120);
      } else if (selKey && (mode === 'follow-vehicle' || mode === 'navigation-vehicle')) {
        const live = motionMap.get(selKey)?.frame(Date.now());
        if (live) {
          const frame = vehicleCameraFrame(live, mode);
          map.easeTo({
            center: frame.center,
            zoom: frame.zoom,
            pitch: frame.pitch,
            bearing: frame.bearing,
            duration: TICK_MS + 120,
            easing: (t) => t,
            padding: { bottom: cameraBottomPaddingRef.current + 48 },
          });
        }
      }

      ensureRaf();
    };

    ingestRef.current = ingestPositions;
    refreshRef.current = refreshVehicles;
    cameraApplyRef.current = () => {
      const mode = cameraModeRef.current;
      if (mode === 'follow-user') {
        followUserFrame();
        return;
      }
      if (mode === 'follow-trip' || ((mode === 'follow-vehicle' || mode === 'navigation-vehicle') && followTripStopRef.current)) {
        applyFollowTripFrame(450);
        return;
      }
      const selKey = selectedRef.current;
      if (!selKey || (mode !== 'follow-vehicle' && mode !== 'navigation-vehicle')) return;
      const live = currentMap.get(selKey) ?? motionMap.get(selKey)?.frame(Date.now());
      if (!live) return;
      const frame = vehicleCameraFrame(live, mode);
      map.easeTo({
        ...frame,
        duration: mode === 'navigation-vehicle' ? 650 : 450,
        padding: { bottom: cameraBottomPaddingRef.current + 48 },
      });
    };

    // ─── Ubicación del usuario ─────────────────────────────
    // El puck y la cámara consumen el MISMO fix (fuente única de verdad).
    // En follow-user cada fix vigente recentra con transición corta.
    const userLocationData = () => {
      const loc = userLocationRef.current;
      if (!loc) return { type: 'FeatureCollection' as const, features: [] };
      return {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [loc.lng, loc.lat] as [number, number] },
            properties: {},
          },
        ],
      };
    };
    const followUserFrame = () => {
      const loc = userLocationRef.current;
      if (!loc) return;
      map.easeTo({
        center: [loc.lng, loc.lat],
        zoom: 15.6,
        pitch: 0,
        bearing: 0,
        duration: 650,
        padding: { bottom: cameraBottomPaddingRef.current },
      });
    };
    // Encuadre dual bondi + parada (modo 'follow-trip'): consume el MISMO frame
    // renderizado que el símbolo. Sin parada disponible, degrada a follow-vehicle.
    const applyFollowTripFrame = (duration: number) => {
      const selKey = selectedRef.current;
      if (!selKey) return;
      const live = currentMap.get(selKey) ?? motionMap.get(selKey)?.frame(Date.now());
      if (!live) return;
      const stop = followTripStopRef.current;
      if (stop) {
        map.fitBounds(
          [
            [Math.min(live.lng, stop.lng), Math.min(live.lat, stop.lat)],
            [Math.max(live.lng, stop.lng), Math.max(live.lat, stop.lat)],
          ],
          {
            padding: clampFitPadding(map, {
              top: 200,
              bottom: cameraBottomPaddingRef.current + 80,
              left: 48,
              right: 48,
            }),
            maxZoom: 16.2,
            pitch: trip3DRef.current || cameraModeRef.current === 'navigation-vehicle' ? 52 : 0,
            bearing: trip3DRef.current || cameraModeRef.current === 'navigation-vehicle' ? live.heading : 0,
            duration,
            easing: (t) => t,
          },
        );
        return;
      }
      const frame = vehicleCameraFrame(live, 'follow-vehicle');
      map.easeTo({
        center: frame.center,
        zoom: frame.zoom,
        pitch: frame.pitch,
        bearing: frame.bearing,
        duration,
        easing: (t) => t,
        padding: { bottom: cameraBottomPaddingRef.current + 48 },
      });
    };
    userLocationApplyRef.current = () => {
      const src = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined;
      src?.setData(userLocationData());
      if (cameraModeRef.current === 'follow-user') followUserFrame();
    };

    // ─── Planner (Fase 4): marcadores + parada con pulso ────
    // Origen/destino como círculos map-aligned (hermanos del puck) y la
    // parada más cercana con anillo pulsante. El pulso es un RAF dedicado
    // que corre SOLO mientras hay parada activa: 2 writes/frame en una
    // capa (mismo presupuesto que el pulso de ruta). Reduced motion:
    // anillo estático, sin RAF.
    const plannerPointsData = () => {
      const draft = plannerPointsRef.current;
      const features = [];
      if (draft?.origin) {
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [draft.origin.lng, draft.origin.lat] as [number, number],
          },
          properties: { kind: 'origin' },
        });
      }
      if (draft?.destination) {
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [draft.destination.lng, draft.destination.lat] as [number, number],
          },
          properties: { kind: 'destination' },
        });
      }
      return { type: 'FeatureCollection' as const, features };
    };
    const plannerPulseData = () => {
      const pulse = plannerPulseRef.current;
      return {
        type: 'FeatureCollection' as const,
        features: pulse
          ? [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [pulse.lng, pulse.lat] as [number, number],
                },
                properties: { color: pulse.color ?? '#1A73E8' },
              },
            ]
          : [],
      };
    };

    let plannerPulseRaf: number | null = null;
    // Período propio del planner (1300ms): NO pisar el reloj maestro del
    // pulso de ruta (1800ms, module-level) — el breathe del mapa y el dot
    // de la lista comparten ese período.
    const PLANNER_PULSE_PERIOD_MS = 1300;
    const applyPlannerPulsePhase = (t: number) => {
      if (!map.getLayer('planner-pulse-ring')) return;
      const phase = (t % PLANNER_PULSE_PERIOD_MS) / PLANNER_PULSE_PERIOD_MS;
      map.setPaintProperty('planner-pulse-ring', 'circle-radius', 6 + phase * 14);
      map.setPaintProperty('planner-pulse-ring', 'circle-opacity', 0.42 * (1 - phase));
    };
    const plannerPulseFrame = (t: number) => {
      plannerPulseRaf = null;
      if (disposed) return;
      if (!document.hidden && plannerPulseRef.current) applyPlannerPulsePhase(t);
      plannerPulseRaf = requestAnimationFrame(plannerPulseFrame);
    };
    const startPlannerPulse = () => {
      if (disposed || plannerPulseRaf !== null) return;
      if (reduceMotionRef.current) {
        // Reduced motion: anillo fijo sobrio, cero animación.
        if (map.getLayer('planner-pulse-ring')) {
          map.setPaintProperty('planner-pulse-ring', 'circle-radius', 11);
          map.setPaintProperty('planner-pulse-ring', 'circle-opacity', 0.2);
        }
        return;
      }
      plannerPulseRaf = requestAnimationFrame(plannerPulseFrame);
    };
    const stopPlannerPulse = () => {
      if (plannerPulseRaf !== null) {
        cancelAnimationFrame(plannerPulseRaf);
        plannerPulseRaf = null;
      }
      if (!disposed && map.getLayer('planner-pulse-ring')) {
        map.setPaintProperty('planner-pulse-ring', 'circle-opacity', 0);
      }
    };
            const tripSegmentsData = () => {
          const segs = tripSegmentsRef.current;
          if (!segs || segs.length === 0) {
            return { type: 'FeatureCollection' as const, features: [] };
          }
          return {
            type: 'FeatureCollection' as const,
            features: segs.map((seg, idx) => ({
              type: 'Feature' as const,
              id: `trip-seg-${idx}`,
              geometry: {
                type: 'LineString' as const,
                coordinates: seg.coordinates,
              },
              properties: {
                type: seg.type,
                color: seg.color,
                isDashed: seg.isDashed ? 1 : 0,
              },
            })),
          };
        };

        const tripUsedStopsData = () => {
          const ids = tripUsedStopIdsRef.current;
          if (!ids || ids.length === 0) {
            return { type: 'FeatureCollection' as const, features: [] };
          }
          // Rol por posición: primera=subida, última=bajada, medio=transbordo.
          return {
            type: 'FeatureCollection' as const,
            features: ids.map((id, idx) => {
              const p = (DATASET.paradas as Record<string, { lat: number; lng: number; nombre: string }>)[id];
              if (!p) return null;
              const role = idx === 0 ? 'board' : idx === ids.length - 1 ? 'alight' : 'transfer';
              return {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
                properties: {
                  id, name: p.nombre, role,
                  color: TRIP_STOP_ROLE_COLOR[role] ?? '#101D3D',
                },
              };
            }).filter((f): f is NonNullable<typeof f> => f !== null),
          };
        };

        plannerApplyRef.current = () => {
          if (disposed || mapRef.current !== map) return;
          const pointsSrc = map.getSource('planner-points') as maplibregl.GeoJSONSource | undefined;
          pointsSrc?.setData(plannerPointsData());
          const pulseSrc = map.getSource('planner-pulse') as maplibregl.GeoJSONSource | undefined;
          pulseSrc?.setData(plannerPulseData());
          const segsSrc = map.getSource('trip-active-segments') as maplibregl.GeoJSONSource | undefined;
          segsSrc?.setData(tripSegmentsData());
          const usedSrc = map.getSource('trip-used-stops') as maplibregl.GeoJSONSource | undefined;
          usedSrc?.setData(tripUsedStopsData());
          if (plannerPulseRef.current) startPlannerPulse();
          else stopPlannerPulse();
        };

    // Un gesto manual libera la cámara y habilita el CTA de recentrado.
    const stopFollow = () => {
      if (
        cameraModeRef.current === 'follow-vehicle' ||
        cameraModeRef.current === 'follow-trip' ||
        cameraModeRef.current === 'navigation-vehicle' ||
        cameraModeRef.current === 'follow-user' ||
        cameraModeRef.current === 'step-focus'
      ) {
        cameraModeRef.current = 'free';
        cameraModeHandlerRef.current?.('free');
      }
    };
    map.on('dragstart', stopFollow);
    map.on('zoomstart', (event) => { if (event.originalEvent) stopFollow(); });
    map.on('rotatestart', (event) => { if (event.originalEvent) stopFollow(); });
    map.on('pitchstart', (event) => { if (event.originalEvent) stopFollow(); });

    // ─── Sombra en pitch: ajuste EVENT-DRIVEN (sin RAF) ─────
    // Al cruzar 25° de pitch la sombra se estira y oscurece UNA vez —
    // el ajuste es instantáneo y las transitions del paint lo suavizan
    // sin writes por frame. El bus isométrico es billboard por diseño;
    // el cenital queda alineado al plano.
    let lastTilted = false;
    const updateShadowTilt = () => {
      const tilted = (map.getPitch() ?? 0) >= 25;
      if (disposed || tilted === lastTilted) return;
      lastTilted = tilted;
      if (!map.getLayer('bus-shadow')) return;
      map.setPaintProperty('bus-shadow', 'icon-translate', tilted ? [3, 6] : [2, 3]);
      map.setPaintProperty('bus-shadow', 'icon-opacity', tilted ? 0.34 : 0.22);
    };
    map.on('pitch', updateShadowTilt);
    map.on('pitchend', updateShadowTilt);

    // ─── Rotación de cámara: reasienta el billboard isométrico ─────
    // El iso rota según heading − bearing (pantalla). Durante la ventana
    // de animación el refresco por frame ya cubre el gesto; este hook
    // event-driven cubre la rotación manual fuera de ventana, con
    // throttle de 120ms y un reasentado final al soltar. Sin RAF.
    let lastRotateRefresh = 0;
    const scheduleRotateRefresh = () => {
      const now = performance.now();
      if (tripPulseActiveRef.current && !reduceMotionRef.current && map.getLayer('trip-seg-pulse')) {
        const tripPhase = Math.floor((now % (TRIP_FLOW_STEP_MS * TRIP_DASH.length)) / TRIP_FLOW_STEP_MS);
        if (tripPhase !== lastTripFlowPhase) { lastTripFlowPhase = tripPhase; map.setPaintProperty('trip-seg-pulse', 'line-dasharray', TRIP_DASH[tripPhase]!); }
      }
      if (now - lastRotateRefresh < 120) return;
      lastRotateRefresh = now;
      refreshVehicles();
    };
    map.on('rotate', scheduleRotateRefresh);
    map.on('rotateend', () => {
      if (disposed) return;
      refreshVehicles();
    });

    // ─── Animación de flujo en la ruta resaltada ────────────
    // ─── Corriente en la ruta (spec #872): cabeza + estela ──
    // 12 fases @80ms = ciclo de 960ms — "flujo continuo" sin flicker.
    // Cada array SIEMPRE 4 segmentos [head, gap, dash, tail]: cantidad
    // constante → sin re-tessellation extra entre pasos. La estela
    // [k−5, k) termina exactamente donde empieza la cabeza → contacto
    // perfecto: se lee CORRIENTE, no puntos sueltos.
    const DASH_HEAD: number[][] = [
      [0, 0, 3, 9], [0, 1, 3, 8], [0, 2, 3, 7], [0, 3, 3, 6],
      [0, 4, 3, 5], [0, 5, 3, 4], [0, 6, 3, 3], [0, 7, 3, 2],
      [0, 8, 3, 1], [0, 9, 3, 0], [1, 9, 2, 0], [2, 9, 1, 0],
    ];
    const DASH_TAIL: number[][] = [
      [0, 7, 5, 0], [1, 7, 4, 0], [2, 6, 4, 0], [3, 5, 4, 0],
      [4, 4, 4, 0], [0, 0, 5, 7], [0, 1, 5, 6], [0, 2, 5, 5],
      [0, 3, 5, 4], [0, 4, 5, 3], [0, 5, 5, 2], [0, 6, 5, 1],
    ];
    const FLOW_STEP_MS = 80;
    const TRIP_FLOW_STEP_MS = 90;
    const TRIP_DASH: number[][] = [[0, 0, 2, 8], [0, 1, 2, 7], [0, 2, 2, 6], [0, 3, 2, 5], [0, 4, 2, 4], [0, 5, 2, 3], [0, 6, 2, 2], [0, 7, 2, 1], [0, 8, 2, 0], [1, 8, 1, 0]];
    let lastFlowPhase = -1;
    let lastTripFlowPhase = -1;
    const applyFlowPhase = (phase: number) => {
      if (!map.getLayer('route-flow-head')) return;
      map.setPaintProperty('route-flow-head', 'line-dasharray', DASH_HEAD[phase]!);
      map.setPaintProperty('route-flow-tail', 'line-dasharray', DASH_TAIL[phase]!);
    };
    // Animación de flujo desactivada temporalmente a pedido del usuario (sin línea blanca segmentada)
    const startFlow = () => {};
    const stopFlow = () => {};

    // ─── Pulso de ruta: Kick + Breathe (spec #861) ─────────
    // RAF propio: solo corre con UNA línea en foco y pestaña visible.
    // Kick 650ms easeOutCubic al ganar foco + breathe 1800ms en
    // contrafase entre los 2 halos. Handoff continuo: el kick se SUMA
    // al breathe, así nunca hay salto de valor.
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
    let kickStart = -Infinity;
    let pulseRaf: number | null = null;
    let pulseFocus = false;
    const setHalo = (layerId: string, opacity: number, blur: number) => {
      if (disposed || mapRef.current !== map || !map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, 'line-opacity', opacity);
      map.setPaintProperty(layerId, 'line-blur', blur);
    };
    const pulseFrame = () => {
      pulseRaf = null;
      if (disposed) return;
      const now = performance.now();
      if (tripPulseActiveRef.current && !reduceMotionRef.current && map.getLayer('trip-seg-pulse')) {
        const tripPhase = Math.floor((now % (TRIP_FLOW_STEP_MS * TRIP_DASH.length)) / TRIP_FLOW_STEP_MS);
        if (tripPhase !== lastTripFlowPhase) { lastTripFlowPhase = tripPhase; map.setPaintProperty('trip-seg-pulse', 'line-dasharray', TRIP_DASH[tripPhase]!); }
      }
      const phase = (((now - PULSE_ORIGIN) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS) * Math.PI * 2;
      const breatheA = 0.5 - 0.5 * Math.cos(phase);
      const breatheB = 0.5 - 0.5 * Math.cos(phase + Math.PI);
      const kick = 1 - easeOutCubic(Math.min(1, (now - kickStart) / 650));
      // Breathe con amplitud reducida: las halos son el ESTADO (fondo
      // que respira) y la corriente es la ACCIÓN — nunca compiten.
      setHalo('route-halo-a', Math.min(0.6, 0.1 + 0.11 * breatheA + 0.35 * kick), 6 + 8 * (1 - breatheA));
      setHalo('route-halo-b', Math.min(0.45, 0.08 + 0.09 * breatheB), 10 + 8 * (1 - breatheB));
      // Corriente: escribiendo SOLO cuando cambia la fase (cada 80ms)
      if (!reduceMotionRef.current) {
        const flowPhase = Math.floor(((now - PULSE_ORIGIN) % (FLOW_STEP_MS * 12)) / FLOW_STEP_MS);
        if (flowPhase !== lastFlowPhase) {
          lastFlowPhase = flowPhase;
          applyFlowPhase(flowPhase);
        }
      }
      if (!document.hidden) pulseRaf = requestAnimationFrame(pulseFrame);
    };
    const stopPulse = () => {
      if (disposed) return;
      if (pulseRaf !== null) {
        cancelAnimationFrame(pulseRaf);
        pulseRaf = null;
      }
      setHalo('route-halo-a', 0, 6);
      setHalo('route-halo-b', 0, 10);
      if (map.getLayer('trip-seg-pulse')) map.setPaintProperty('trip-seg-pulse', 'line-opacity', 0);
    };
    const startPulse = () => {
      if (map.getLayer('trip-seg-pulse')) map.setPaintProperty('trip-seg-pulse', 'line-opacity', tripPulseActiveRef.current ? 0.88 : 0);
      if (pulsePausedRef.current) return;
      if (reduceMotionRef.current) {
        setHalo('route-halo-a', 0.16, 8);
        setHalo('route-halo-b', 0.08, 12);
        return;
      }
      if (pulseRaf === null && !disposed && !document.hidden) {
        pulseRaf = requestAnimationFrame(pulseFrame);
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (pulseRaf !== null) {
          cancelAnimationFrame(pulseRaf);
          pulseRaf = null;
        }
      } else {
        startPulse();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Control expuesto al mundo React (pausa por sheet expandido)
    pulseControlRef.current = { start: startPulse, stop: stopPulse, isFocused: () => pulseFocus };

    const applyHighlight = () => {
      // Sin early-return por isStyleLoaded: puede ser false dentro de
      // 'load' (glyphs pendientes) y las rutas quedarían ocultas para
      // siempre. Los getLayer por capa ya protegen contra capas ausentes.
      if (disposed) return;
      // Rutas consolidadas (plan §9): UNA source + capas compartidas.
      // El filtro por lineId reemplaza 20 capas individuales (5 líneas
      // × 4) — escala a una red grande sin multiplicar capas.
      const active = highlightRef.current;
      const routeFilter = (
        active.length > 0
          ? [
              'any',
              ['in', ['get', 'lineId'], ['literal', active]],
              ['in', ['get', 'ramalId'], ['literal', active]],
              ['in', ['get', 'recorridoId'], ['literal', active]],
            ]
          : ['==', ['get', 'lineId'], '__ninguna__']
      ) as never;
      for (const prefix of ['route-casing', 'route-line', 'route-flow-head', 'route-flow-tail', 'route-arrows', 'route-halo-a', 'route-halo-b']) {
        if (map.getLayer(prefix)) {
          map.setFilter(prefix, routeFilter);
        }
      }

      // Pulso + corriente: máximo UNA línea con foco (spec #861/#872).
      // El kick se dispara al ganar/tocar el foco; sin foco, todo en
      // silencio (halos opacidad 0, corriente apagada con fade 240ms).
      pulseFocus = active.length === 1;
      if (pulseFocus) {
        kickStart = performance.now();
        startFlow();
        startPulse();
      } else {
        stopFlow();
        stopPulse();
      }

      // Encuadre suave sobre el recorrido completo de la línea o ramal seleccionados (evita saltar a paradas random)
      if (active && active.length === 1 && active[0] !== 'all' && cameraModeRef.current === 'overview') {
        const activeKey = active[0];
        let routeCoords: [number, number][] = [];
        if (MOCK_ROUTES[activeKey] && MOCK_ROUTES[activeKey].length > 0) {
          routeCoords = MOCK_ROUTES[activeKey];
        } else {
          const lineaObj = DATASET.lineas.find((l) => l.id === activeKey);
          if (lineaObj) {
            routeCoords = lineaObj.ramales.flatMap((r) => r.recorridos.flatMap((rec) => rec.coordenadas));
          } else {
            for (const l of DATASET.lineas) {
              const r = l.ramales.find((ram) => ram.id === activeKey);
              if (r) {
                routeCoords = r.recorridos.flatMap((rec) => rec.coordenadas);
                break;
              }
            }
          }
        }
        if (routeCoords.length > 0) {
          const lons = routeCoords.map((c) => c[0]);
          const lats = routeCoords.map((c) => c[1]);
          map.fitBounds(
            [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)],
            ],
            {
              padding: { top: 90, bottom: cameraBottomPaddingRef.current + 70, left: 65, right: 65 },
              duration: 900,
              maxZoom: 14.5,
              essential: true,
            },
          );
        }
      }

      // Paradas: solo las de las líneas o ramales resaltados
      const stopSrc = map.getSource('stops') as maplibregl.GeoJSONSource | undefined;
      if (stopSrc) {
        const active = highlightRef.current;
        const hlSet = active && active.length > 0 ? new Set(active) : null;

        let activeStopIds: Set<string>;

        // Modo foco: SOLO paradas usadas en el trip (abordaje, transbordo,
        // descenso). No todas las de las líneas implicadas.
        const usedIds = tripUsedStopIdsRef.current;
        if (tripFocusRef.current && usedIds && usedIds.length > 0) {
          activeStopIds = new Set(usedIds);
        } else if (!hlSet || hlSet.size === 0) {
          // Ocultas por defecto: sin línea ni ramal seleccionado, 0 paradas visibles
          activeStopIds = new Set<string>();
        } else if (hlSet.has('all')) {
          activeStopIds = new Set(Object.keys(DATASET.paradas));
        } else {
          activeStopIds = new Set<string>();
          for (const key of hlSet) {
            // Si es un ramal puntual (ej: 'ramal-194-a', 'ramal-194-h', 'ramal-65-troncal')
            if (MOCK_LINE_STOPS[key]) {
              MOCK_LINE_STOPS[key]!.forEach((pId) => activeStopIds.add(pId));
            } else {
              // Si es una línea completa (ej: 'line-194' o 'line-65')
              const lineaObj = DATASET.lineas.find((l) => l.id === key);
              if (lineaObj) {
                lineaObj.ramales.forEach((r) => {
                  r.recorridos.forEach((rec) => {
                    rec.paradas.forEach((pId) => activeStopIds.add(pId));
                  });
                });
              }
            }
          }
        }

        const filteredFeatures = Object.values(DATASET.paradas)
          .filter((p) => activeStopIds.has(p.id))
          .map((p) => {
            let stopColor = '#101D3D';
            if (hlSet && hlSet.size === 1) {
              const activeKey = Array.from(hlSet)[0]!;
              stopColor = RAMAL_COLORS[activeKey] || LINE_COLORS[activeKey] || (p.id.startsWith('stop-65') ? '#0284C7' : '#16A34A');
            } else if (p.id.startsWith('stop-65')) {
              stopColor = '#0284C7';
            } else {
              stopColor = '#16A34A';
            }

            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
              properties: {
                id: p.id,
                name: p.nombre,
                color: stopColor,
              },
            };
          });

        stopSrc.setData({
          type: 'FeatureCollection',
          features: filteredFeatures,
        });
      }

      // Refrescar vehículos de forma inmediata ante cambio de línea/ramal
      refreshVehicles();
    };

    applyRef.current = applyHighlight;

    // ─── Tema ──────────────────────────────────────────────
    const isDark = () => themeRef.current === 'dark';

    // ─── Interacción (una sola vez): los handlers ligados a capas
    // sobreviven al swap de estilo porque se resuelven por id al
    // dispararse, y las capas se vuelven a crear con los mismos ids.
    const stopPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 14,
      className: 'rutaba-stop-popup',
    });
    stopPopup.on('close', () => {
      stopSelectHandlerRef.current?.('');
    });
    stopPopupRef.current = stopPopup;

    map.on('mouseenter', 'stops', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      const stopId = String(f.properties?.id ?? '');
      const stopName = String(f.properties?.name ?? 'Parada');
      const llegadas = TransportService.getLlegadasPorParada(stopId, positionsRef.current);
      const prox = llegadas[0];
      const etaText = prox?.displayLabel || 'Cada 5 min';
      const isVuelta = stopId.includes('stop-65-1') && stopId !== 'stop-65-01';
      const stopObj = MOCK_STOPS.find((s) => s.id === stopId) || DATASET.paradas[stopId];
      const stopLines = stopObj && 'lineIds' in stopObj && (stopObj.lineIds as string[])?.length > 0
        ? (stopObj.lineIds as string[]).map((id: string) => id.replace('line-', '')).join(', ')
        : (stopId.startsWith('stop-65') ? '65' : '194');
      const lineBadgeColor = stopId.startsWith('stop-65')
        ? (isVuelta ? '#EA580C' : '#0284C7')
        : '#16A34A';

      stopPopup
        .setLngLat(coords)
        .setHTML(createStopPopupCardHtml(stopName, stopLines, lineBadgeColor, etaText))
        .addTo(map);

      const elem = stopPopup.getElement();
      if (elem) {
        elem.style.cursor = 'pointer';
        elem.onclick = (ev) => {
          ev.stopPropagation();
          stopPopup.remove();
          stopSelectHandlerRef.current?.('');
        };
      }
    });
    map.on('mouseleave', 'stops', () => {
      map.getCanvas().style.cursor = '';
      if (!selectedStopIdRef.current) {
        stopPopup.remove();
      }
    });
    const interactiveBusLayers = ['buses-badge', 'buses', 'buses-iso'];
    for (const layer of interactiveBusLayers) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    const emitSelection = (f: MapPointFeatureLike & { geometry?: { coordinates?: unknown } }) => {
      if (!f.properties) return;
      const coordinates = f.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const key = `${String(f.properties.lineId)}-${String(f.properties.unitId)}`;
      const live = currentMap.get(key);
      const meta = metaMap.get(key);
      cameraModeRef.current = 'follow-vehicle';
      cameraModeHandlerRef.current?.('follow-vehicle');
      selectHandlerRef.current?.({
        lineId: String(f.properties.lineId),
        unitId: String(f.properties.unitId),
        ramalId: meta?.ramalId ?? (f.properties.ramalId ? String(f.properties.ramalId) : undefined),
        direction: meta?.direction,
        lng: live?.lng ?? Number(coordinates[0]),
        lat: live?.lat ?? Number(coordinates[1]),
        heading: live?.heading ?? Number(f.properties.heading ?? 0),
        speed: live?.speed ?? 0,
        timestamp: live?.timestamp ?? Date.now(),
      });
    };

    // Click con tolerancia táctil (tap slop de 14px, como Google Maps):
    // el feature más cercano al punto se selecciona; fuera → deselecciona.
    // En pickMode (planificador) el tap fija el punto y NO selecciona buses.
    map.on('click', (e) => {
      if (pickModeRef.current && pickHandlerRef.current) {
        pickHandlerRef.current([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      const r = 14; // tap slop px
      const box: [[number, number], [number, number]] = [
        [e.point.x - r, e.point.y - r],
        [e.point.x + r, e.point.y + r],
      ];

      // Prioridad a paradas si se clickea sobre una parada
      if (map.getLayer('stops')) {
        const stopFeats = map.queryRenderedFeatures(box, { layers: ['stops'] });
        if (stopFeats.length > 0) {
          const stopId = String(stopFeats[0]?.properties?.id ?? '');
          if (stopId) {
            // Si se hace clic en la misma parada ya seleccionada, deseleccionar
            if (selectedStopIdRef.current === stopId) {
              stopPopup.remove();
              stopSelectHandlerRef.current?.('');
              return;
            }

            const geom = stopFeats[0].geometry;
            const coords: [number, number] = geom.type === 'Point' ? (geom.coordinates as [number, number]) : [0, 0];
            // Cinemática de zoom
            map.easeTo({
              center: [coords[0], coords[1]],
              zoom: 16.2,
              pitch: 28,
              duration: 1000,
              padding: { bottom: cameraBottomPaddingRef.current + 80 },
              essential: true,
            });

            const stopName = String(stopFeats[0]?.properties?.name ?? 'Parada');
            const llegadas = TransportService.getLlegadasPorParada(stopId, positionsRef.current);
            const prox = llegadas[0];
            const etaText = prox?.displayLabel || 'Cada 5 min';
            const isVuelta = stopId.includes('stop-65-1') && stopId !== 'stop-65-01';
            const stopObj = MOCK_STOPS.find((s) => s.id === stopId) || DATASET.paradas[stopId];
            const stopLines = stopObj && 'lineIds' in stopObj && (stopObj.lineIds as string[])?.length > 0
              ? (stopObj.lineIds as string[]).map((id: string) => id.replace('line-', '')).join(', ')
              : (stopId.startsWith('stop-65') ? '65' : '194');
            const lineBadgeColor = stopId.startsWith('stop-65')
              ? (isVuelta ? '#EA580C' : '#0284C7')
              : '#16A34A';

            stopPopup
              .setLngLat(coords)
              .setHTML(createStopPopupCardHtml(stopName, stopLines, lineBadgeColor, etaText))
              .addTo(map);

            const elem = stopPopup.getElement();
            if (elem) {
              elem.style.cursor = 'pointer';
              elem.onclick = (ev) => {
                ev.stopPropagation();
                stopPopup.remove();
                stopSelectHandlerRef.current?.('');
              };
            }

            stopSelectHandlerRef.current?.(stopId);
            return;
          }
        }
      }

      const layers = interactiveBusLayers.filter((id) => map.getLayer(id));
      if (layers.length === 0) return; // estilo en pleno swap — ignorar
      const rendered = map.queryRenderedFeatures(box, { layers });
      const unique = new Map<string, (typeof rendered)[number]>();
      for (const feature of rendered) {
        const lineId = String(feature.properties?.lineId ?? '');
        const unitId = String(feature.properties?.unitId ?? '');
        const key = `${lineId}-${unitId}`;
        if (lineId && unitId && !unique.has(key)) unique.set(key, feature);
      }
      const feats = [...unique.values()];
      if (feats.length === 0) {
        selectHandlerRef.current?.(null);
        if (selectedStopIdRef.current) {
          stopPopup.remove();
          stopSelectHandlerRef.current?.('');
        }
        return;
      }
      let best = feats[0];
      let bestD = Infinity;
      for (const f of feats) {
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        const c = map.project([coords[0], coords[1]]);
        const d = Math.hypot(c.x - e.point.x, c.y - e.point.y);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      emitSelection(best as unknown as MapPointFeatureLike & { geometry?: { coordinates?: unknown } });
    });

    // ─── Instalación de capas (re-ejecutable tras cada setStyle) ──
    let entryDone = false;
    const installOverlays = async () => {
      if (disposed) return;
      const dark = isDark();

      // ─── Edificios 3D (primero: quedan bajo rutas y buses) ──
      // El source 'carto' viene del estilo base y sobrevive: source-layer
      // 'building' con render_height del schema OpenMapTiles.
      map.addLayer({
        id: 'buildings3d',
        type: 'fill-extrusion',
        source: 'carto',
        'source-layer': 'building',
        minzoom: 15.4,
        paint: {
          'fill-extrusion-color': dark ? '#26304A' : '#E4E0D5',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15.4, 0, 16.2, dark ? 0.95 : 0.85],
        },
      });

      // ─── Rutas (invisibles hasta que se seleccionen) ──────
      // Consolidadas (plan §9): source única + capas compartidas con
      // color por feature. Flecha de sentido: imagen compartida.
      const arrowImg = await svgToImageData(routeArrowSvg());
      if (arrowImg && !map.hasImage('route-arrow')) map.addImage('route-arrow', arrowImg, { pixelRatio: 2 });

      const routeFeatures = [];
      for (const linea of DATASET.lineas) {
        for (const ramal of linea.ramales) {
          for (const rec of ramal.recorridos) {
            // Colores diferenciados entre ida y vuelta para cada ramal
            const isVuelta = rec.sentido === 'vuelta';
            const color = rec.color || (
              linea.id === 'line-65'
                ? (isVuelta ? '#EA580C' : '#0284C7')
                : (isVuelta ? lightenHex(ramal.color || linea.color, 0.45) : (ramal.color || linea.color))
            );
            routeFeatures.push({
              type: 'Feature' as const,
              properties: {
                lineId: linea.id,
                ramalId: ramal.id,
                recorridoId: rec.id,
                ramalNombre: ramal.nombre,
                direction: rec.sentido,
                color,
                colorLight: lightenHex(color),
              },
              geometry: { type: 'LineString' as const, coordinates: rec.coordenadas },
            });
          }
        }
      }

      // FOUC de capas: nazcan OCULTAS (filter __ninguna__) — applyHighlight
      // recién habilita la línea activa. Sin esto parpadean todas las rutas.
      const HIDE_ALL_ROUTES = ['==', ['get', 'lineId'], '__ninguna__'] as never;

      map.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routeFeatures,
        },
      });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#E8ECF2' : '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 15.5, 7.8, 18, 10],
          'line-opacity': 0.9,
          'line-offset': [
            'interpolate', ['linear'], ['zoom'],
            10, ['match', ['get', 'direction'], 'ida', 1.2, 'vuelta', 1.2, 0],
            14, ['match', ['get', 'direction'], 'ida', 2.2, 'vuelta', 2.2, 0],
            18, ['match', ['get', 'direction'], 'ida', 3.8, 'vuelta', 3.8, 0]
          ],
        },
      });
      // Pulso de ruta: 2 halos contrafase (Kick + Breathe, spec #861).
      // Sólo se anima line-opacity/line-blur (uniforms GPU baratos por
      // frame). OJO: "zoom" sólo puede ser input de un interpolate de
      // PRIMER nivel — no se puede envolver en ['+', interp, k] (spec
      // de MapLibre); el ancho va aplanado en un interpolate directo.
      map.addLayer({
        id: 'route-halo-a',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 16, 16.5, 18],
          'line-opacity': 0,
          'line-blur': 6,
        },
      });
      map.addLayer({
        id: 'route-halo-b',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 20, 16.5, 24],
          'line-opacity': 0,
          'line-blur': 10,
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.2, 15.5, 4.6, 18, 6.4],
          'line-opacity': 0.96,
          'line-offset': [
            'interpolate', ['linear'], ['zoom'],
            10, ['match', ['get', 'direction'], 'ida', 1.2, 'vuelta', 1.2, 0],
            14, ['match', ['get', 'direction'], 'ida', 2.2, 'vuelta', 2.2, 0],
            18, ['match', ['get', 'direction'], 'ida', 3.8, 'vuelta', 3.8, 0]
          ],
        },
      });
      map.addLayer({
        id: 'route-flow-tail',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: {
          'line-color': ['get', 'colorLight'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.8, 15.5, 5.4, 18, 7.4],
          'line-opacity': 0,
        },
      });
      map.addLayer({
        id: 'route-flow-head',
        type: 'line',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.4, 15.5, 3.5, 18, 4.8],
          'line-opacity': 0,
          'line-blur': 0.4,
          'line-dasharray': [0, 0, 3, 9],
          'line-opacity-transition': { duration: 240 },
        },
      });
      // Flechas de sentido: symbol-placement 'line' rota cada chevron
      // según la dirección del recorrido (orden de los coordenadas).
      map.addLayer({
        id: 'route-arrows',
        type: 'symbol',
        source: 'routes',
        filter: HIDE_ALL_ROUTES,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 150,
          'icon-image': 'route-arrow',
          'icon-rotation-alignment': 'map',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 16.5, 0.42],
          'icon-allow-overlap': false,
          'icon-ignore-placement': true,
        },
      });

      // ─── Paradas ──────────────────────────────────────────
      map.addSource('stops', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: highlightRef.current && highlightRef.current.length > 0
            ? MOCK_STOPS.map((s) => {
                const isVuelta = s.id.includes('stop-65-1') && s.id !== 'stop-65-01';
                return {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
                  properties: {
                    id: s.id,
                    name: s.name,
                    color: isVuelta ? '#EF4444' : '#0EA5E9',
                  },
                };
              })
            : [],
        },
      });
      map.addLayer({
        id: 'stops',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 6, 17, 8],
          'circle-color': '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2.5,
        },
      });
      // Los handlers de popup de 'stops' viven FUERA de installOverlays
      // (plan §9: listeners únicos que sobreviven al swap de estilo).

      // ─── Señales urbanas y POIs reales de OpenStreetMap ────
      // Snapshot v2 offline (scripts/fetch-pois.mjs): iconos legacy
      // (worship/supermarket/station) + taxonomía nueva del plan §8
      // (semáforos, PARE, cruces, hospitales, landmarks curados).
      // Ayuda visual, NO dato vial oficial — cobertura OSM incompleta.
      const POIS = await loadUrbanFeatures();
      if (disposed) return;
      const iconSpecs: { id: string; svg: string }[] = [
        { id: 'poi-place_of_worship', svg: poiIconSvg('church') },
        { id: 'poi-supermarket', svg: poiIconSvg('supermarket') },
        { id: 'poi-station', svg: poiIconSvg('station') },
        ...URBAN_ICON_TYPES.map((t) => ({ id: `poi-${t}`, svg: urbanIconSvg(t) })),
      ];
      const loadedPois = await Promise.all(
        iconSpecs.map(async (spec) => ({ id: spec.id, data: await svgToImageData(spec.svg, 48) })),
      );
      if (disposed) return;
      for (const ic of loadedPois) {
        if (ic.data && !map.hasImage(ic.id)) map.addImage(ic.id, ic.data, { pixelRatio: 2 });
      }
      map.addSource('pois', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: POIS.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] as [number, number] },
            properties: { type: p.type, name: p.name ?? '' },
          })),
        },
      });
      // POIs con nombre: zoom medio (estaciones, hospitales, templos...)
      // beforeId: los iconos de ciudad viven DEBAJO de las rutas — dan
      // vida al mapa sin obstruir la línea del recorrido.
      map.addLayer(
        {
          id: 'poi-icons',
          type: 'symbol',
          source: 'pois',
          minzoom: 13.6,
          filter: ['in', ['get', 'type'], ['literal', [...NAMED_POI_TYPES]]],
          layout: {
            'icon-image': ['concat', 'poi-', ['get', 'type']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 13.6, 0.6, 16.5, 0.85],
            'icon-allow-overlap': false,
            'icon-padding': 2,
          },
        },
        'route-casing',
      );
      map.addLayer(
        {
          id: 'poi-labels',
          type: 'symbol',
          source: 'pois',
          minzoom: 15.1,
          filter: ['all', ['in', ['get', 'type'], ['literal', [...NAMED_POI_TYPES]]], ['!=', ['get', 'name'], '']],
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10.5,
            'text-offset': [0, 1.15],
            'text-anchor': 'top',
            'text-max-width': 8,
            'text-optional': true,
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': dark ? '#C9D2DF' : '#101D3D',
            'text-halo-width': 1.5,
            'text-halo-color': dark ? '#0D1117' : '#FFFFFF',
            'text-opacity': ['interpolate', ['linear'], ['zoom'], 15.1, 0, 16, 1],
          },
        },
        'route-casing',
      );
      // Semáforos y PARE: sólo en zoom de calle (16.2+) — más vistosos
      // pero siempre por debajo del recorrido
      map.addLayer(
        {
          id: 'signal-icons',
          type: 'symbol',
          source: 'pois',
          minzoom: SIGNAL_MIN_ZOOM,
          filter: ['in', ['get', 'type'], ['literal', [...SIGNAL_TYPES]]],
          layout: {
            'icon-image': ['concat', 'poi-', ['get', 'type']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 16.2, 0.55, 17.5, 0.78],
            'icon-allow-overlap': false,
            'icon-padding': 6,
          },
        },
        'route-casing',
      );
      // Cruces peatonales: aún más cerca (17) para no saturar
      map.addLayer(
        {
          id: 'crossing-icons',
          type: 'symbol',
          source: 'pois',
          minzoom: CROSSING_MIN_ZOOM,
          filter: ['in', ['get', 'type'], ['literal', [...CROSSING_TYPES]]],
          layout: {
            'icon-image': ['concat', 'poi-', ['get', 'type']],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 17, 0.45, 18, 0.62],
            'icon-allow-overlap': false,
            'icon-padding': 6,
          },
        },
        'route-casing',
      );

      // ─── Paradas estilo Moovit/SUBE sobre rutas resaltadas ────
      const stopFeatures = ROUTE_STOPS.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] as [number, number] },
        properties: { lineId: s.lineId, name: s.name, color: LINE_COLORS[s.lineId] ?? '#101D3D' },
      }));
      map.addSource('route-stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stopFeatures } });
      map.addLayer({
        id: 'route-stops',
        type: 'circle',
        source: 'route-stops',
        minzoom: 13.2,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.2, 2.8, 16, 4.2],
          'circle-color': '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2.2,
          'circle-pitch-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'route-stops-label',
        type: 'symbol',
        source: 'route-stops',
        minzoom: 15.6,
        filter: ['!=', ['get', 'name'], ''],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10.5,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': dark ? '#D7DEE8' : '#37474F',
          'text-halo-width': 1.4,
          'text-halo-color': dark ? '#0D1117' : '#FFFFFF',
        },
      });

      // ─── Buses: un solo marcador circular (estilo Uber) + glow ────
      // Iso Uber Stealth voluminoso: 3 variantes por línea (recta / giro
      // izquierda / giro derecha) para el rig del eje delantero; el
      // match de icon-image elige la correcta por feature, sin writes
      // extra. Canvas 178×90 con el cuerpo centrado (pivot de rotación
      // del billboard) e icon-size subido ~25%: el urbano ahora se lee
      // con masa, no como una galleta.
      const ISO_W = 178;
      const ISO_H = 90;
      const iconDefs: { id: string; svg: string; w: number; h: number }[] = [
        ...MOCK_LINES.flatMap((line) => [
          { id: `badge-${line.id}`, svg: busBadgeSvg(line.color, line.shortName), w: 96, h: 96 },
          { id: `badge-${line.id}-ida`, svg: busBadgeSvg('#0EA5E9', line.shortName), w: 96, h: 96 },
          { id: `badge-${line.id}-vuelta`, svg: busBadgeSvg('#EF4444', line.shortName), w: 96, h: 96 },
          { id: `heading-${line.id}`, svg: busHeadingSvg(line.color), w: 96, h: 96 },
          { id: `heading-${line.id}-ida`, svg: busHeadingSvg('#0EA5E9'), w: 96, h: 96 },
          { id: `heading-${line.id}-vuelta`, svg: busHeadingSvg('#EF4444'), w: 96, h: 96 },
          { id: `top-${line.id}`, svg: busTopDownSvg(line.color), w: 96, h: 96 },
          { id: `top-${line.id}-ida`, svg: busTopDownSvg('#0EA5E9'), w: 96, h: 96 },
          { id: `top-${line.id}-vuelta`, svg: busTopDownSvg('#EF4444'), w: 96, h: 96 },
          { id: `iso-${line.id}`, svg: busIsoSvg(line.color), w: ISO_W, h: ISO_H },
          { id: `iso-${line.id}-ida`, svg: busIsoSvg('#0EA5E9'), w: ISO_W, h: ISO_H },
          { id: `iso-${line.id}-vuelta`, svg: busIsoSvg('#EF4444'), w: ISO_W, h: ISO_H },
          { id: `isoL-${line.id}`, svg: busIsoSvg(line.color, -1), w: ISO_W, h: ISO_H },
          { id: `isoL-${line.id}-ida`, svg: busIsoSvg('#0EA5E9', -1), w: ISO_W, h: ISO_H },
          { id: `isoL-${line.id}-vuelta`, svg: busIsoSvg('#EF4444', -1), w: ISO_W, h: ISO_H },
          { id: `isoR-${line.id}`, svg: busIsoSvg(line.color, 1), w: ISO_W, h: ISO_H },
          { id: `isoR-${line.id}-ida`, svg: busIsoSvg('#0EA5E9', 1), w: ISO_W, h: ISO_H },
          { id: `isoR-${line.id}-vuelta`, svg: busIsoSvg('#EF4444', 1), w: ISO_W, h: ISO_H },
          { id: `isoFlip-${line.id}`, svg: busIsoSvg(line.color, 0, true), w: ISO_W, h: ISO_H },
          { id: `isoFlip-${line.id}-ida`, svg: busIsoSvg('#0EA5E9', 0, true), w: ISO_W, h: ISO_H },
          { id: `isoFlip-${line.id}-vuelta`, svg: busIsoSvg('#EF4444', 0, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipL-${line.id}`, svg: busIsoSvg(line.color, -1, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipL-${line.id}-ida`, svg: busIsoSvg('#0EA5E9', -1, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipL-${line.id}-vuelta`, svg: busIsoSvg('#EF4444', -1, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipR-${line.id}`, svg: busIsoSvg(line.color, 1, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipR-${line.id}-ida`, svg: busIsoSvg('#0EA5E9', 1, true), w: ISO_W, h: ISO_H },
          { id: `isoFlipR-${line.id}-vuelta`, svg: busIsoSvg('#EF4444', 1, true), w: ISO_W, h: ISO_H },
        ]),
        { id: 'shadow-blob', svg: busShadowSvg(), w: 96, h: 96 },
      ];
      const loaded = await Promise.all(
        iconDefs.map(async (def) => ({ id: def.id, data: await svgToImageData(def.svg, def.w, def.h) })),
      );
      if (disposed) return;
      for (const icon of loaded) {
        if (icon.data && !map.hasImage(icon.id)) map.addImage(icon.id, icon.data, { pixelRatio: 2 });
      }

      map.addSource('vehicles', {
        type: 'geojson',
        data: buildFeatures(),
      });

        map.addLayer({
          id: 'bus-glow',
          type: 'circle',
          source: 'vehicles',
          filter: ['==', ['get', 'selected'], 1],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 14, 14, 18, 16, 24],
            'circle-color': '#FFFFFF',
            'circle-opacity': 0.28,
            'circle-blur': 0.6,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.9,
          },
        });

        // Trail fantasma — cometa bajo el vehículo seleccionado
        map.addSource('bus-trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'bus-trail',
          type: 'circle',
          source: 'bus-trail',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'age'], 0, 5.2, 15, 1.8],
            'circle-color': '#FFFFFF',
            'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.8, 15, 0.08],
          },
        });

        // ─── Buses: 3 capas (sombra / cenital / isométrico) ──
        // Sombra SIEMPRE pegada al piso (pitch-alignment 'map'): el
        // cuerpo se para como billboard y la sombra queda en la calle —
        // es lo que vende la masa (truco de juegos 2D).
        map.addLayer({
          id: 'bus-shadow',
          type: 'symbol',
          source: 'vehicles',
          minzoom: 14.2,
          layout: {
            'icon-image': 'shadow-blob',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 14.2, 0.75, 16, 0.97, 19, 1.2],
            // La elipse nace con el eje largo horizontal: −90° la alinea
            // al rumbo (map-aligned) — ancla física bajo el billboard.
            'icon-rotate': ['get', 'shadowRotate'],
            'icon-rotation-alignment': 'map',
            'icon-pitch-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-translate': [2, 3],
            'icon-opacity': 0.22,
          },
        });

        map.addLayer({
          id: 'buses-heading',
          type: 'symbol',
          source: 'vehicles',
          maxzoom: 13.5,
          layout: {
            'icon-image': ['get', 'headingIcon'],
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.58, 13, 0.64],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        map.addLayer({
          id: 'buses-badge',
          type: 'symbol',
          source: 'vehicles',
          maxzoom: 13.5,
          layout: {
            'icon-image': ['get', 'badge'],
            'icon-rotation-alignment': 'viewport',
            'icon-pitch-alignment': 'viewport',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.55, 13, 0.6],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // Vehículo cenital (z 13.4→15.6): bus top-down que se desvanece
        // con el zoom mientras el isométrico lo reemplaza (crossfade por
        // zoom, GPU — interpolates top-level, cero writes por frame).
        map.addLayer({
          id: 'buses',
          type: 'symbol',
          source: 'vehicles',
          minzoom: 13.4,
          maxzoom: 15.8,
          layout: {
            'icon-image': ['get', 'topDown'],
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              13.4, 0.54,
              14.4, 0.62,
              15.6, 0.72,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 1, 15.6, 0],
          },
        });

        // Vehículo isométrico 3/4 (z ≥ 14.4): BILLBOARD relativo a cámara.
        // Queda plano contra la pantalla (rotation+pitch 'viewport') y rota
        // en el plano de pantalla según heading − camBearing: nunca se
        // voltea en el espacio al cruzar esquinas o al rotar la cámara.
        // En navegación (bearing = heading) siempre apunta hacia arriba.
        // La verdad del rumbo sobre el mapa la llevan cenital y sombra.
        // icon-size recalibrado: el canvas nuevo (152×132) es más grande
        // que el 96×96 viejo — mismos px aparentes en pantalla.
        map.addLayer({
          id: 'buses-iso',
          type: 'symbol',
          source: 'vehicles',
          minzoom: 14.4,
          layout: {
            'icon-image': ['get', 'iso'],
            'icon-rotate': ['get', 'isoRotate'],
            'icon-rotation-alignment': 'viewport',
            'icon-pitch-alignment': 'viewport',
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14.4, 0.41,
              15.6, 0.48,
              17.5, 0.57,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 0, 15.6, 1],
          },
        });

        // Etiqueta de línea — fija al viewport (no rota), bajo la unidad
        map.addLayer({
          id: 'bus-labels',
          type: 'symbol',
          source: 'vehicles',
          minzoom: 13.5,
          layout: {
            'text-field': ['get', 'shortName'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 13.4, 10.5, 16, 11.5],
            'text-offset': [0, 1.35],
            'text-anchor': 'top',
            'text-rotation-alignment': 'viewport',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-padding': 0,
          },
          paint: {
            'text-color': '#FFFFFF',
            'text-halo-width': 1.6,
            'text-halo-color': '#101D3D',
            'text-halo-blur': 0.5,
          },
        });

      // ─── Ubicación del usuario: puck azul + halo (encima de todo) ────
      // Fuente única consumida por puck y cámara (userLocationApplyRef).
      map.addSource('user-location', { type: 'geojson', data: userLocationData() });
      map.addLayer({
        id: 'user-halo',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 14, 17, 17],
          'circle-color': '#1A73E8',
          'circle-opacity': 0.16,
          'circle-pitch-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'user-puck',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 16, 7.5, 17, 9],
          'circle-color': '#1A73E8',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.5,
          'circle-pitch-alignment': 'map',
        },
      });

      // ─── Planner (Fase 4): origen/destino + parada con pulso ────
      // Por encima de rutas y POIs: son el foco vigente del usuario.
      map.addSource('planner-points', { type: 'geojson', data: plannerPointsData() });
      map.addLayer({
        id: 'planner-origin',
        type: 'circle',
        source: 'planner-points',
        filter: ['==', ['get', 'kind'], 'origin'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#1A73E8',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.5,
          'circle-pitch-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'planner-destination',
        type: 'circle',
        source: 'planner-points',
        filter: ['==', ['get', 'kind'], 'destination'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#0D1420',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.5,
          'circle-pitch-alignment': 'map',
        },
      });
      map.addSource('planner-pulse', { type: 'geojson', data: plannerPulseData() });
      map.addLayer({
        id: 'planner-pulse-ring',
        type: 'circle',
        source: 'planner-pulse',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.42,
          'circle-pitch-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'planner-pulse-dot',
        type: 'circle',
        source: 'planner-pulse',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-pitch-alignment': 'map',
        },
      });

      // ─── Ruta activa del viaje seleccionado (UX selección) ───
      // Sin estas capas, tripSegments actualizaba un source invisible.
      // Casing blanco + línea en color del segmento; walk/transfer dashed.
      map.addSource('trip-active-segments', { type: 'geojson', data: tripSegmentsData() });
      map.addLayer({
        id: 'trip-seg-casing',
        type: 'line',
        source: 'trip-active-segments',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 7,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'trip-seg-line',
        type: 'line',
        source: 'trip-active-segments',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
          'line-dasharray': [
            'case',
            ['==', ['get', 'isDashed'], 1],
            ['literal', [2, 2]],
            ['literal', [1, 0]],
          ],
        },
      });

      map.addLayer({
        id: 'trip-seg-pulse', type: 'line', source: 'trip-active-segments',
        filter: ['==', ['get', 'type'], 'ride'],
        paint: { 'line-color': '#FFFFFF', 'line-width': 1.5, 'line-opacity': 0, 'line-blur': 0.35, 'line-dasharray': [0, 0, 2, 8] },
      });
      // Reaplica modo foco tras (re)instalación (ej: cambio de tema).
      if (tripFocusRef.current) {
        for (const layerId of TRIP_FOCUS_HIDDEN_LAYERS) {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
          }
        }
      }

      // ─── Paradas del trip con roles + etiquetas ───
      map.addSource('trip-used-stops', { type: 'geojson', data: tripUsedStopsData() });
      map.addLayer({
        id: 'trip-used-stops-halo',
        type: 'circle',
        source: 'trip-used-stops',
        paint: {
          'circle-radius': 13,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'trip-used-stops',
        type: 'circle',
        source: 'trip-used-stops',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'trip-used-stops-label',
        type: 'symbol',
        source: 'trip-used-stops',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-font': ['Noto Sans Bold'],
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
          'text-max-width': 12,
        },
        paint: {
          'text-color': '#0D1420',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      });

      // Estado pitch vigente tras un swap de estilo (las capas nuevas
      // nacen alineadas al mapa; si la cámara está inclinada, corrijo).
      updateShadowTilt();

      // ─── Cámara: entrada animada SOLO en la primera instalación ──
      // Tras un swap de tema la cámara no se toca: el usuario conserva
      // su vista y su unidad seguida.
      if (!entryDone) {
        entryDone = true;
        const allCoords = Object.values(MOCK_ROUTES).flat();
        if (allCoords.length > 0) {
          const lons = allCoords.map((c) => c[0]);
          const lats = allCoords.map((c) => c[1]);
          map.fitBounds(
            [
              [Math.min(...lons), Math.min(...lats)],
              [Math.max(...lons), Math.max(...lats)],
            ],
            {
              padding: { top: 120, bottom: 110, left: 50, right: 50 },
              duration: 2000,
              essential: true,
            },
          );
        }
      }

      applyHighlight();
      // Re-aplica cuando el mapa quede idle: si isStyleLoaded era false
      // durante load, las visibilities se corrigen al terminar todo.
      map.once('idle', () => { if (!disposed) applyHighlight(); });
      ingestPositions();
    };

    // ─── Cambio de tema: reset completo de estilo + reinstalación ──
    // diff: false garantiza un estilo limpio (sin mezclar capas viejas);
    // 'style.load' re-dispara la instalación con los ids conocidos.
    let styleSwapping = false;
    themeApplyRef.current = () => {
      if (styleSwapping || disposed) return;
      styleSwapping = true;
      map.setStyle(isDark() ? BASEMAP_DARK : BASEMAP_LIGHT, { diff: false });
      map.once('style.load', () => {
        styleSwapping = false;
        void installOverlays();
      });
    };

    const installInitialOverlays = () => {
      refreshCanvasAfterStableLayout();
      void installOverlays();
    };
    // load espera también las fuentes del basemap. En WebKit eso dejó rutas,
    // paradas y vehículos sin instalar hasta que terminaran los tiles de CARTO.
    // style.load ya registra las fuentes/capas y permite montar overlays antes.
    if (map.isStyleLoaded()) {
      installInitialOverlays();
    } else {
      map.once('style.load', installInitialOverlays);
    }
    map.on('style.load', refreshCanvasAfterStableLayout);
    refreshCanvasAfterStableLayout();

    return () => {
      // disposed PRIMERO: todos los writes protegidos (setHalo, stopFlow,
      // stopPulse) salen temprano y el cleanup nunca toca el mapa en
      // mitad de un swap de estilo.
      disposed = true;
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      if (layoutRefreshRafId !== null) cancelAnimationFrame(layoutRefreshRafId);
      ro.disconnect();
      stopFlow();
      stopPulse();
      stopPlannerPulse();
      plannerApplyRef.current = () => {};
      pulseControlRef.current = null;
      applyRef.current = () => {};
      ingestRef.current = () => {};
      refreshRef.current = () => {};
      cameraApplyRef.current = () => {};
      userLocationApplyRef.current = () => {};
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      if (rafId !== null) cancelAnimationFrame(rafId);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nuevas posiciones → interpolar hacia los targets
  useEffect(() => {
    positionsRef.current = positions;
    ingestRef.current();
  }, [positions]);

  // Rutas visibles ↔ selección de líneas
  useEffect(() => {
    highlightRef.current = highlightLines;
    applyRef.current();
  }, [highlightLines]);

  // Modo foco del viaje: mantiene buses seleccionados y filtra paradas
  // a solo las usadas en el trip.
  useEffect(() => {
    tripFocusRef.current = tripFocus;
    const map = mapRef.current;
    if (!map) return;
    for (const layerId of TRIP_FOCUS_HIDDEN_LAYERS) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', tripFocus ? 'none' : 'visible');
      }
    }
    applyRef.current();
  }, [tripFocus]);

  // Selección → re-render del glow bajo el bus
  useEffect(() => {
    selectedRef.current = selectedKey;
    refreshRef.current();
  }, [selectedKey]);

  // Cámara controlada externamente sin recrear la instancia WebGL.
  useEffect(() => {
    cameraModeRef.current = cameraMode;
    cameraBottomPaddingRef.current = cameraBottomPadding;
    cameraModeHandlerRef.current = onCameraModeChange;
    followTripStopRef.current = followTripStop;
    trip3DRef.current = trip3D;
    cameraApplyRef.current();
  }, [cameraMode, cameraBottomPadding, onCameraModeChange, followTripStop, trip3D]);

  // Fix de ubicación → actualiza puck y, en follow-user, recentra cámara.
  useEffect(() => {
    userLocationRef.current = userLocation;
    userLocationApplyRef.current();
  }, [userLocation]);

  // Pulso pausado cuando el sheet expandido tapa el mapa (spec #861)
  useEffect(() => {
    pulsePausedRef.current = routePulsePaused;
    if (routePulsePaused) {
      pulseControlRef.current?.stop();
    } else if (pulseControlRef.current?.isFocused()) {
      pulseControlRef.current?.start();
    }
  }, [routePulsePaused]);

  useEffect(() => {
    tripPulseActiveRef.current = tripPulseActive;
    if (tripPulseActive) pulseControlRef.current?.start();
    else if (!pulseControlRef.current?.isFocused()) pulseControlRef.current?.stop();
  }, [tripPulseActive]);
  // Tema claro/oscuro → swap de basemap + reinstalación de capas
  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    themeApplyRef.current();
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={className}
      // NO promover este contenedor a capa compuesta propia. MapLibre inyecta
      // su <canvas> WebGL acá adentro: si el padre lleva `transform: translateZ(0)`
      // + `will-change: transform` + `backface-visibility: hidden`, WebKit (Safari
      // iOS y cualquier WKWebView, incluido el browser in-app de Telegram) culla
      // la capa del canvas en el plano 3D coplanar y NO la pinta: el mapa queda
      // en negro sin tiles, sin colectivos, sin recorrido y sin paradas, mientras
      // el resto del DOM (header, cards, modales) se ve perfecto. Blink (Chrome
      // desktop / Android) tolera el hack y por eso el bug es iOS-only.
      style={{ width: '100%', height: '100%' }}
    />
  );
}
