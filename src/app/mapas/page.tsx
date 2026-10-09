"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import DynamicMap from "@/components/map/DynamicMap";
import LineSelectorBar, { getRamalLetter, getRamalDisplayName } from "@/components/ui-shell/LineSelectorBar";
import LiveTransportBubble from "@/components/ui-shell/LiveTransportBubble";
import { BottomNav } from "@/components/ui/bottom-nav";
import ViajeHeader from "@/components/viaje/ViajeHeader";
import ViajePanel from "@/components/viaje/ViajePanel";
import ArrivalStatusCard from "@/components/viaje/ArrivalStatusCard";
import { TransportService } from "@/lib/services/transport-service";
import { TripPlannerService } from "@/lib/services/trip-planner-service";
import { subscribeToPositions } from "@/mock/live";
import { MOCK_LINES, MOCK_ROUTES, MOCK_STOPS } from "@/mock/data";
import { getRouteTrack, stopsAlongRoute, busProgressOn } from "@/lib/map/route-progress";
import type { VehiclePosition } from "@/lib/data-service";
import { segmentBearing, type CameraMode } from "@/lib/map/camera-controller";
import type { MapFocusRequest, PlannerMapPoints, PlannerMapPulse, TripRouteShade } from "@/components/map/MapCanvas";
import { Parada } from "@/types/transport";
import { DATASET } from "@/lib/mock/amba-data";
import type { LineaDefinition, TransportNetworkDataset } from "@/types/transport";
import { TripOption, LocationPoint, TransitLeg } from "@/types/trip-planner";
import { Navigation, RotateCcw, Eye, X, Search, Layers } from "lucide-react";
import { SIMULATED_USER_LOCATION, SIMULATED_LOCATION_LABEL, requestDeviceLocation, DeviceLocationError } from "@/lib/config/user-location";
import { parseTripMapState, buildTripMapState, tripMapUrlFromState, tripJourneyUrlFromState, etaToBoardingStop, hasPassedStop, hasCompletedRide, viajandoSubPhase, ARRIVAL_EPS_M, ARRIVAL_EPS_S, BOARDING_DWELL_MS, type TripMapNavigationState, type ArrivalPhase } from "@/lib/trip-map-navigation";
import { buildBoardingOptions, boardingHeroLabel, boardingUnitKeyOf } from "@/lib/services/trip-boarding-options";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const ALL_LINE_IDS = MOCK_LINES.map((l) => l.id);

/** Sentinel de descarte explícito de unidad (el usuario la cerró a mano). */
const MANUAL_NONE_UNIT = "__none__";

/** sdd/trip-options-upgrade 1.3: padding dual del sheet (colapsado/expandido). */
const TRIP_PAD_COLLAPSED = 160;
const TRIP_PAD_EXPANDED = 514;

/** Techo de zoom del foco por paso: un segmento corto no sobre-zoomea. */
const STEP_FOCUS_MAX_ZOOM = 16.5;

/** Padding relativo al extent: 6% a cada lado (compacto, para que el
 *  recorrido ocupe casi todo el viewport). 12% se veía con mucho aire. */
const LINE_FILTER_PADDING_RATIO = 0.06;

/**
 * Calcula los bounds [[minLng,minLat],[maxLng,maxLat]] que abarcan todas las
 * coordenadas (recorridos) de las líneas pedidas. Si una línea no existe o no
 * tiene recorridos, se ignora silenciosamente.
 *
 * El padding mínimo garantiza que un solo punto (cabecera) no se renderice
 * con zoom infinito.
 */
function computeLineasBounds(
  lineaIds: string[],
  dataset: TransportNetworkDataset,
): [[number, number], [number, number]] | null {
  if (lineaIds.length === 0) return null;
  const lineasById = new Map<string, LineaDefinition>(
    dataset.lineas.map((l) => [l.id, l]),
  );
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const id of lineaIds) {
    const linea = lineasById.get(id);
    if (!linea) continue;
    for (const ramal of linea.ramales) {
      for (const rec of ramal.recorridos) {
        for (const [lng, lat] of rec.coordenadas) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          any = true;
        }
      }
    }
  }
  if (!any) return null;
  const padLng = Math.max((maxLng - minLng) * LINE_FILTER_PADDING_RATIO, 0.002);
  const padLat = Math.max((maxLat - minLat) * LINE_FILTER_PADDING_RATIO, 0.002);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ];
}

/**
 * Variante "smart" de computeLineasBounds (PBI-034 v4): en lugar de usar el
 * extent completo de las coordenadas de los recorridos (que se sale a La Plata
 * para la 195, Luján para la 365, etc.), toma SOLO las paradas que tienen
 * combinaciones con subte/tren/metrobus. Eso centra la cámara en la zona
 * "interesante" (CABA + combinaciones) y permite zoom mucho más alto, en lugar
 * de alejarse para abarcar outliers suburbanos.
 *
 * Si el set no tiene paradas con combinaciones, fallback al extent completo
 * de coordenadas (caso edge: una línea sin combinaciones, ej: interurbana).
 */
function computeCombinacionesBounds(
  lineaIds: string[],
  dataset: TransportNetworkDataset,
): [[number, number], [number, number]] | null {
  if (lineaIds.length === 0) return null;
  const lineasById = new Map<string, LineaDefinition>(
    dataset.lineas.map((l) => [l.id, l]),
  );
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const id of lineaIds) {
    const linea = lineasById.get(id);
    if (!linea) continue;
    for (const ramal of linea.ramales) {
      for (const rec of ramal.recorridos) {
        for (const stopId of rec.paradas) {
          const parada = dataset.paradas[stopId];
          if (!parada) continue;
          const tieneConexion =
            (parada.conexiones?.subte && parada.conexiones.subte.length > 0) ||
            (parada.conexiones?.tren && parada.conexiones.tren.length > 0) ||
            parada.conexiones?.metrobus === true;
          if (!tieneConexion) continue;
          if (parada.lng < minLng) minLng = parada.lng;
          if (parada.lng > maxLng) maxLng = parada.lng;
          if (parada.lat < minLat) minLat = parada.lat;
          if (parada.lat > maxLat) maxLat = parada.lat;
          any = true;
        }
      }
    }
  }
  if (!any) return null;
  const padLng = Math.max((maxLng - minLng) * LINE_FILTER_PADDING_RATIO, 0.002);
  const padLat = Math.max((maxLat - minLat) * LINE_FILTER_PADDING_RATIO, 0.002);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ];
}

/** Clave del trip vivo: cualquier cambio invalida los pins de otro viaje. */
function buildTripKey(
  origin: LocationPoint | null,
  destination: LocationPoint | null,
  tripId: string | null,
): string {
  const o = origin ? `${origin.stopId ?? origin.name}|${origin.lat.toFixed(5)}|${origin.lng.toFixed(5)}` : "?";
  const d = destination ? `${destination.name}|${destination.lat.toFixed(5)}|${destination.lng.toFixed(5)}` : "?";
  return `${o}>${d}#${tripId ?? "-"}`;
}

/**
 * Bounds por defecto de la Línea 195 (Retiro → La Plata). Se usa como vista
 * inicial del mapa cuando el usuario entra a /mapas sin filtros ni trip activo,
 * para mostrar el recorrido completo CABA-La Plata (PBI-034 v7).
 *
 * Padding del 6% en cada lado (igual que el filtro multi-línea) para que las
 * cabeceras no queden pegadas al borde.
 */
function computeLinea195Bounds(
  dataset: TransportNetworkDataset,
): [[number, number], [number, number]] | null {
  const linea = dataset.lineas.find((l) => l.id === "line-195");
  if (!linea) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ramal of linea.ramales) {
    for (const rec of ramal.recorridos) {
      for (const [lng, lat] of rec.coordenadas) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  if (minLng === Infinity) return null;
  const padLng = Math.max((maxLng - minLng) * LINE_FILTER_PADDING_RATIO, 0.002);
  const padLat = Math.max((maxLat - minLat) * LINE_FILTER_PADDING_RATIO, 0.002);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ];
}

export default function TransportesAppPage() {
  const { resolvedTheme } = useTheme();
  const [mapUnavailable, setMapUnavailable] = useState(false);
  // PBI-034 v11: en mobile (< 640dp) usamos jumpTo con zoom fijo alto (no
  // fitBounds) para que el usuario vea las calles y combinaciones DE CERCA.
  // fitBounds elige el zoom mínimo tal que el extent quepa, lo que aleja
  // la cámara para extent > 5-10 km. JumpTo con zoom fijo prioriza "ver
  // de cerca" sobre "ver extent completo". En desktop dejamos fitBounds
  // porque el viewport es más grande y el extent cabe a zoom razonable.
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 640;
  });
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobileViewport(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const [isLineMenuOpen, setIsLineMenuOpen] = useState<boolean>(false);
  // Orientación breve de la entrada "Explorar mapa" (Home): coachmark
  // descartable junto al rail de líneas. No persiste ni tapa controles.
  const [showExploreHint, setShowExploreHint] = useState(false);
  const lineas = useMemo(() => TransportService.getLineas(), []);
  const paradas = useMemo(() => TransportService.getParadas(), []);
  const alertas = useMemo(() => TransportService.getAlertas(), []);

  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; heading?: number | null; accuracy?: number } | null>(null);
  const [selectedLineaId, setSelectedLineaId] = useState<string | null>(null);
  const [selectedRamalId, setSelectedRamalId] = useState<string | null>(null);
  // Filtro multi-línea para entradas de Red Metropol (?lineas=line-65,line-109,...).
  // Vacío = comportamiento single-line (selectedLineaId manda). Con 1+ ids, el mapa
  // muestra el set completo: posiciones, trazas y chip de "N líneas" en el header.
  const [lineaFilter, setLineaFilter] = useState<string[]>([]);
  const [selectedParada, setSelectedParada] = useState<Parada | null>(null);
  const [stopFocusNonce, setStopFocusNonce] = useState(0);
  const [selectedVehiculo, setSelectedVehiculo] = useState<VehiclePosition | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("overview");
  // Vista 3D en Viaje: la cámara dual (bondi+parada) se inclina con pitch/bearing
  // y arranca activada al abrir/entrar al viaje (pedido de producto).
  const [trip3D, setTrip3D] = useState(true);
  // Ubicación real del dispositivo como origen (botón circular en el header).
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ─── Estado del Modo "Viaje" (Ubicaciones Arbitrarias / Paradas / POIs) ──
  const [isTripMode, setIsTripMode] = useState<boolean>(false);
  const [originLocation, setOriginLocation] = useState<LocationPoint | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LocationPoint | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  // Fase step-focus: nonce monotónico en STATE (nunca un ref dentro del memo
  // focusRequest) para re-disparar el fitBounds del paso seleccionado.
  const [stepFocusNonce, setStepFocusNonce] = useState(0);
  const [mapPickTarget, setMapPickTarget] = useState<"origin" | "destination" | null>(null);
  const [isTripHeaderCollapsed, setIsTripHeaderCollapsed] = useState(false);
  // Semilla del contrato portable (Home): se lee UNA vez; después todo deriva
  // del estado vivo (origen/destino/opción) + feed. No es un cerebro paralelo.
  const [tripSeed, setTripSeed] = useState<TripMapNavigationState | null>(null);
  // Pins explícitos con su tripKey: preferencia vigente (taps o semilla).
  // En STATE (no refs) para leerlos en memos sin violar react-hooks/refs.
  const [boardingPin, setBoardingPin] = useState<{ stopId: string; forTripKey: string } | null>(null);
  const [vehiclePin, setVehiclePin] = useState<{ lineId: string; unitId: string; forTripKey: string } | null>(null);
  // Visibilidad de la vista de viaje (rosa/X): al ocultar NO se pierde el estado,
  // solo el chrome (pills/panel) y la cámara vuelve a overview.
  const [tripViewVisible, setTripViewVisible] = useState<boolean>(true);
  // Parada de abordaje legacy (?parada+?linea sin trip): robustez ante la carrera
  // entre el feed de 1 Hz y la selección de la parada en el mount.
  const [legacyBoardingStop, setLegacyBoardingStop] = useState<{ lat: number; lng: number } | null>(null);
  // Re-dispara el encuadre del trip al re-entrar a la vista (rosa).
  const [tripReframeNonce, setTripReframeNonce] = useState(0);
  // sdd/trip-options-upgrade: unidad elegida en las 3 filas (lineId-interno).
  // El resolver la prefiere; el reset sigue siendo solo via arrivalResetKey.
  const [boardingUnitKey, setBoardingUnitKey] = useState<string | null>(null);
  // sdd/trip-options-upgrade: colapso del ViajePanel para padding dual + reframe.
  const [isTripPanelCollapsed, setIsTripPanelCollapsed] = useState(false);
  // Aire inferior dinámico según el sheet (declarado antes del focusRequest).
  const tripBottomPadding = isTripPanelCollapsed ? TRIP_PAD_COLLAPSED : TRIP_PAD_EXPANDED;

  // Suscripción al feed GPS en tiempo real (1 Hz) de todas las unidades
  useEffect(() => {
    const unsubscribe = subscribeToPositions(ALL_LINE_IDS, (latestPositions) => {
      setPositions(latestPositions);

      setSelectedVehiculo((current) => {
        if (!current) return null;
        const updated = latestPositions.find(
          (p) => p.lineId === current.lineId && p.unitId === current.unitId,
        );
        return updated || current;
      });
    });

    return () => unsubscribe();
  }, []);

  const selectedLinea = useMemo(() => {
    return selectedLineaId ? lineas.find((l) => l.id === selectedLineaId) || null : null;
  }, [selectedLineaId, lineas]);

  const selectedRamal = useMemo(() => {
    if (!selectedLinea || !selectedRamalId) return null;
    return selectedLinea.ramalesDetalle?.find((r) => r.id === selectedRamalId) || null;
  }, [selectedLinea, selectedRamalId]);

  // ─── Planificación de Viaje Reactiva Basada en Motor Real ────────────
  // (arriba a propósito: tripOptions/selectedTrip alimentan al resolver único
  // del que dependen filtros, overlay, follow y cámara).
  const tripOptions = useMemo(() => {
    if (!originLocation || !destinationLocation) return [];
    return TripPlannerService.planTrip(originLocation, destinationLocation);
  }, [originLocation, destinationLocation]);

  const selectedTrip = useMemo(() => {
    if (tripOptions.length === 0) return null;
    return tripOptions.find((t: TripOption) => t.id === selectedTripId) || tripOptions[0] || null;
  }, [tripOptions, selectedTripId]);

  // Clave del trip vivo (memo) para validar pins.
  const tripKey = useMemo(
    () => buildTripKey(originLocation, destinationLocation, selectedTripId),
    [originLocation, destinationLocation, selectedTripId],
  );

  // Cerebro único: de qué viaje hablamos, dónde subo y en qué línea/ramal.
  // Prioridad de abordaje: pin vigente > semilla (mismo trip) > primer ride > origen.
  const resolvedTrip = useMemo(() => {
    if (!selectedTrip) return null;
    const ride = selectedTrip.legs.find((leg): leg is TransitLeg => leg.type === "ride");
    const boardingStopId =
      (boardingPin && boardingPin.forTripKey === tripKey ? boardingPin.stopId : undefined) ??
      (tripSeed?.boardingStopId && tripSeed.selectedTripId === selectedTrip.id
        ? tripSeed.boardingStopId
        : undefined) ??
      ride?.fromStop.id ??
      selectedTrip.originStopId ??
      selectedTrip.origin.stopId;
    return {
      trip: selectedTrip,
      key: tripKey,
      boardingStopId,
      lineId: ride?.lineaId,
      ramalId: ride?.ramalId,
    };
  }, [selectedTrip, tripKey, boardingPin, tripSeed]);

  // A3: el corte visual se deriva de la parada de abordaje fija, nunca del
  // GPS del colectivo. Cambia solo al elegir otro viaje o parada de referencia.
  const tripRouteShade = useMemo<TripRouteShade | null>(() => {
    if (!resolvedTrip?.boardingStopId) return null;
    const ride = resolvedTrip.trip.legs.find((leg): leg is TransitLeg => leg.type === "ride");
    const stop = TripPlannerService.getStopById(resolvedTrip.boardingStopId);
    if (!ride || !stop) return null;
    return {
      lineId: ride.lineaId,
      ramalId: ride.ramalId,
      recorridoId: ride.recorridoId,
      color: ride.lineaColor,
      referenceStop: { lat: stop.lat, lng: stop.lng },
    };
  }, [resolvedTrip]);

  const regularHighlightLines = useMemo(() => {
    // Multi-filtro desde Red Metropol manda por encima del single-line.
    if (lineaFilter.length > 0) return lineaFilter;
    if (selectedRamalId) return [selectedRamalId];
    if (selectedLineaId) return [selectedLineaId];
    return []; // Ocultas por defecto: trazas invisibles hasta que el usuario elija línea o ramal
  }, [lineaFilter, selectedLineaId, selectedRamalId]);

  const filteredPositions = useMemo(() => {
    if (resolvedTrip && selectedVehiculo) {
      return positions.filter((p) => p.lineId === selectedVehiculo.lineId && p.unitId === selectedVehiculo.unitId);
    }
    if (lineaFilter.length > 0) {
      const set = new Set(lineaFilter);
      return positions.filter((p) => set.has(p.lineId));
    }
    if (selectedRamalId) {
      return positions.filter((p) => p.ramalId === selectedRamalId);
    }
    if (selectedLineaId) {
      return positions.filter((p) => p.lineId === selectedLineaId);
    }
    return [];
  }, [positions, resolvedTrip, selectedVehiculo, lineaFilter, selectedLineaId, selectedRamalId]);

  const selectedKey = useMemo(() => {
    return selectedVehiculo ? `${selectedVehiculo.lineId}-${selectedVehiculo.unitId}` : null;
  }, [selectedVehiculo]);

  const llegadas = useMemo(() => {
    if (!selectedParada) return [];
    return TransportService.getLlegadasPorParada(selectedParada.id, filteredPositions);
  }, [selectedParada, filteredPositions]);

  const timelineStops = useMemo(() => {
    if (!selectedVehiculo) return [];
    const coords = MOCK_ROUTES[selectedVehiculo.lineId];
    if (!coords || coords.length < 2) return [];
    const track = getRouteTrack(selectedVehiculo.lineId, coords);
    if (!track) return [];
    const lineStops = MOCK_STOPS.filter((s) => s.lineIds.includes(selectedVehiculo.lineId));
    return stopsAlongRoute(track, lineStops);
  }, [selectedVehiculo]);

  const busProgress = useMemo(() => {
    if (!selectedVehiculo) return 0;
    const coords = MOCK_ROUTES[selectedVehiculo.lineId];
    if (!coords || coords.length < 2) return 0;
    const track = getRouteTrack(selectedVehiculo.lineId, coords);
    if (!track) return 0;
    return busProgressOn(track, { lng: selectedVehiculo.lng, lat: selectedVehiculo.lat });
  }, [selectedVehiculo]);

  const busAlongM = useMemo(() => {
    if (!selectedVehiculo) return 0;
    const coords = MOCK_ROUTES[selectedVehiculo.lineId];
    if (!coords || coords.length < 2) return 0;
    const track = getRouteTrack(selectedVehiculo.lineId, coords);
    if (!track) return 0;
    return track.project(selectedVehiculo.lng, selectedVehiculo.lat).alongM;
  }, [selectedVehiculo]);

  // ─── Información Contextual del Colectivo Seleccionado ──────────────
  const selectedVehicleInfo = useMemo(() => {
    if (!selectedVehiculo) return null;
    const linea = lineas.find((l) => l.id === selectedVehiculo.lineId) || null;
    // La información del ramal refleja el colectivo seleccionado, sin quedar atada a un filtro previo
    const ramal = linea?.ramalesDetalle?.find((r) => r.id === selectedVehiculo.ramalId) || null;

    let nextStopName: string | null = null;
    let minutesToNextStop: number | null = null;

    if (timelineStops && timelineStops.length > 0) {
      const next = timelineStops.find((s) => s.alongM > busAlongM) || timelineStops[timelineStops.length - 1];
      if (next) {
        nextStopName = next.name;
        const distM = Math.max(0, next.alongM - busAlongM);
        const speedKmh = selectedVehiculo.speed && selectedVehiculo.speed > 5 ? selectedVehiculo.speed : 18;
        minutesToNextStop = Math.max(1, Math.round(distM / ((speedKmh * 1000) / 60)));
      }
    }

    return {
      linea,
      ramal,
      nextStopName,
      minutesToNextStop,
    };
  }, [selectedVehiculo, lineas, timelineStops, busAlongM]);

  const expectedArrival = useMemo(() => {
    if (!resolvedTrip?.boardingStopId || !resolvedTrip.lineId) return null;
    const arrivals = TransportService.getLlegadasPorParada(resolvedTrip.boardingStopId, positions);
    // sdd/trip-options-upgrade 2.1: la unidad tapeada manda (unit-keyed resolver).
    // Fallback preservado: pin › semilla › arrivals[0] — nunca colapsa a arrivals[0]
    // cuando hay una selección explícita.
    if (boardingUnitKey) {
      const tapped = arrivals.find(
        (arrival) =>
          // W2′: las filas sintéticas (SIM-*) no representan una unidad física:
          // nunca deben manejar el hero ETA, la alerta ni la cámara.
          !arrival.simulated &&
          boardingUnitKeyOf(arrival.lineaId, arrival.interno) === boardingUnitKey,
      );
      if (tapped) return tapped;
    }
    return arrivals.find((arrival) =>
      !arrival.simulated &&
      arrival.lineaId === resolvedTrip.lineId &&
      (!selectedVehiculo || arrival.interno === selectedVehiculo.unitId),
    ) ?? null;
  }, [resolvedTrip, positions, selectedVehiculo, boardingUnitKey]);

  // sdd/trip-options-upgrade 2.1: filas de abordaje (≤3) por parada de subida.
  const boardingArrivals = useMemo(() => {
    if (!resolvedTrip?.boardingStopId) return [];
    return TransportService.getLlegadasPorParada(resolvedTrip.boardingStopId, positions);
  }, [resolvedTrip, positions]);

  const boardingOptions = useMemo(() => {
    if (!selectedTrip) return [];
    return buildBoardingOptions(selectedTrip, boardingArrivals);
  }, [selectedTrip, boardingArrivals]);

  const boardingHeroLive = useMemo(
    () => boardingHeroLabel(expectedArrival),
    [expectedArrival],
  );

  // ─── trip-arrival-alert: 3-state arrival machine (sdd/trip-arrival-alert) ─
  // Derives NORMAL → ARRIBANDO → PASSED from the live GPS tick vs
  // `resolvedTrip.boardingStopId` via the cached route track (same projection
  // `TransportService.getLlegadasPorParada` uses). Presentational only: no
  // routing/RAPTOR/camera/ETA recompute.
  const arrivalTrack = useMemo(() => {
    if (!selectedVehiculo) return null;
    const coords = MOCK_ROUTES[selectedVehiculo.lineId];
    if (!coords || coords.length < 2) return null;
    return getRouteTrack(selectedVehiculo.lineId, coords);
  }, [selectedVehiculo]);

  const arrivalStopCoords = useMemo(() => {
    if (!resolvedTrip?.boardingStopId) return null;
    const s = TripPlannerService.getStopById(resolvedTrip.boardingStopId);
    return s ? { lat: s.lat, lng: s.lng } : null;
  }, [resolvedTrip]);

  const arrivalEta = useMemo(() => {
    if (!arrivalTrack || !selectedVehiculo || !arrivalStopCoords) return null;
    return etaToBoardingStop(
      arrivalTrack,
      { lng: selectedVehiculo.lng, lat: selectedVehiculo.lat },
      arrivalStopCoords,
    );
  }, [arrivalTrack, selectedVehiculo, arrivalStopCoords]);

  // Latch: once ARRIBANDO fires it holds through GPS jitter until PASSED.
  // Resets only when the trip leg changes (boarding stop or vehicle key).
  // rAF-deferred setState per repo convention (no sync setState in effects).
  const [latchedArriving, setLatchedArriving] = useState(false);
  // Boarding dwell → transfer → riding (sdd/trip-arrival-alert follow-up):
  // without these, the next-bus resolver below swaps to a new incoming bus on
  // the very first tick past the stop and the transfer animation is skipped.
  // `arrivedAtMs` timestamps the first epsilon hit so ARRIBANDO holds a few
  // seconds (boarding simulation) even on projection jumps. `onboard` freezes
  // the resolver while the user rides 1–2 stops glued to the bus; `rideStops`
  // counts dwelling stops visited after boarding.
  const [arrivedAtMs, setArrivedAtMs] = useState<number | null>(null);
  const [onboard, setOnboard] = useState<{ vehicleKey: string; boardedAtMs: number; lineaNumero: string; unitId: string } | null>(null);
  const [rideStops, setRideStops] = useState<string[]>([]);
  const arrivalResetKey = `${resolvedTrip?.boardingStopId ?? '-'}|${selectedVehiculo ? `${selectedVehiculo.lineId}-${selectedVehiculo.unitId}` : '-'}`;
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLatchedArriving(false);
      setArrivedAtMs(null);
      setOnboard(null);
      setRideStops([]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [arrivalResetKey]);

  useEffect(() => {
    if (!arrivalEta) return;
    if (arrivalEta.distAheadM > ARRIVAL_EPS_M && arrivalEta.etaSeconds > ARRIVAL_EPS_S) return;
    const frame = window.requestAnimationFrame(() => {
      setLatchedArriving(true);
      setArrivedAtMs((prev) => prev ?? Date.now());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [arrivalEta]);

  // Render-pure clock for the dwell/transfer/riding time gates below:
  // `Date.now()` is impure and forbidden during render (react-hooks/purity),
  // so timing reads go through this state, refreshed once per GPS tick while
  // arrival timing matters. rAF-deferred setState per repo convention.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!latchedArriving && !onboard) return;
    const frame = window.requestAnimationFrame(() => {
      setNowMs(Date.now());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [latchedArriving, onboard, arrivalEta]);

  // Dwell gate: PASSED may only fire once the red ARRIBANDO card has been
  // visible for BOARDING_DWELL_MS (bus AT stop, doors open). Pure geometric
  // pass without the dwell would skip the boarding simulation on tick jumps.
  const boardingDwellOk = arrivedAtMs === null || nowMs - arrivedAtMs >= BOARDING_DWELL_MS;

  const arrivalPhase: ArrivalPhase = useMemo(() => {
    if (onboard) {
      // Transfer window first, then VIAJANDO_GREEN (boarding confirmed, brief),
      // then VIAJANDO_YELLOW (riding). Pure via viajandoSubPhase so the node
      // harness can assert the green→yellow timeline. `nowMs`
      // refreshes every GPS tick (1 Hz), so transitions need no extra timer
      // and render stays pure. The mock feed keeps ticking while onboard, so
      // the bus visibly MOVES post-stop with the user puck glued (see glue
      // effect below) — never static.
      return viajandoSubPhase(nowMs - onboard.boardedAtMs);
    }
    if (arrivalEta && arrivalTrack) {
      const passed = hasPassedStop(arrivalEta.distAheadM, arrivalTrack.totalM, latchedArriving);
      if (passed && boardingDwellOk) return 'PASSED';
      if (latchedArriving || arrivalEta.distAheadM <= ARRIVAL_EPS_M || arrivalEta.etaSeconds <= ARRIVAL_EPS_S) return 'ARRIBANDO';
    }
    return 'NORMAL';
  }, [arrivalEta, arrivalTrack, latchedArriving, boardingDwellOk, onboard, nowMs]);

  // Boarding: the instant PASSED becomes visible (dwell satisfied), capture the
  // ride so the resolver below can't swap buses mid-transfer. The boarded
  // identity (línea/coche) is snapshotted here so the PASSED/VIAJANDO card keeps
  // rendering from the latch even if the feed ETA for the passed stop drops.
  // rAF-deferred.
  useEffect(() => {
    if (onboard || arrivalPhase !== 'PASSED' || !selectedVehiculo) return;
    const vehicleKey = `${selectedVehiculo.lineId}-${selectedVehiculo.unitId}`;
    const boardedAtMs = Date.now();
    const lineaNumero = expectedArrival?.lineaNumero ?? selectedVehicleInfo?.linea?.numero ?? selectedVehiculo.lineId.replace("line-", "");
    const unitId = selectedVehiculo.unitId;
    const frame = window.requestAnimationFrame(() => {
      setOnboard({ vehicleKey, boardedAtMs, lineaNumero, unitId });
      setRideStops([]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboard, arrivalPhase, selectedVehiculo, expectedArrival, selectedVehicleInfo]);

  // Riding stop counter: each dwell at a stop past the boarding stop is one
  // stop ridden. The mock engine reports isDwelling + currentStopId at 1 Hz.
  useEffect(() => {
    if (!onboard || !selectedVehiculo?.isDwelling || !selectedVehiculo.currentStopId) return;
    const stopId = selectedVehiculo.currentStopId;
    if (stopId === resolvedTrip?.boardingStopId) return;
    const frame = window.requestAnimationFrame(() => {
      setRideStops((prev) => (prev.includes(stopId) ? prev : [...prev, stopId]));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboard, selectedVehiculo, resolvedTrip]);

  // Ride release: after VIAJANDO stops (or the timeout fallback) the demo
  // loops back to waiting — latch + ride clear so the resolver picks the next
  // incoming bus as it does today. `nowMs` re-fires this every GPS tick while
  // onboard, so the timeout fallback can't stall. rAF-deferred.
  useEffect(() => {
    if (!onboard) return;
    if (!hasCompletedRide(rideStops.length, nowMs - onboard.boardedAtMs)) return;
    const frame = window.requestAnimationFrame(() => {
      setOnboard(null);
      setLatchedArriving(false);
      setArrivedAtMs(null);
      setRideStops([]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboard, rideStops, nowMs]);

  // User glued to the bus while onboard: mirror the bus position into the
  // simulated user location every GPS tick. rAF-deferred per repo convention.
  useEffect(() => {
    if (!onboard || !selectedVehiculo) return;
    const { lat, lng } = selectedVehiculo;
    const frame = window.requestAnimationFrame(() => {
      setUserLocation({ lat, lng });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [onboard, selectedVehiculo]);

  // Countdown minutes for the white card: mismo valor que la fila de abordaje y
  // el hero (`getLlegadas.minutos`) para que el número no quede desparejo entre
  // las 3 superficies. `arrivalEta` (geométrico) sigue manejando solo la fase
  // ARRIBANDO/PASSED. Fallback geométrico si no hay arrival del feed.
  const arrivalMinutes = expectedArrival
    ? Math.max(1, expectedArrival.minutos)
    : arrivalEta
      ? Math.max(1, Math.ceil(arrivalEta.etaSeconds / 60))
      : null;

  // Boarded identity for the transfer/riding card: live ETA while the bus is
  // still the nearest arrival, onboard snapshot once it wraps past the stop.
  // Guarantees the PASSED transfer window renders instead of unmounting.
  const cardLineaNumero = expectedArrival?.lineaNumero ?? onboard?.lineaNumero ?? null;

  // Parada de abordaje para el encuadre dual: la del trip resuelto, la
  // seleccionada o la legacy. Sin parada no hay follow-trip (solo follow-vehicle).
  const followTripStop = useMemo(() => {
    if (resolvedTrip?.boardingStopId) {
      const s = TripPlannerService.getStopById(resolvedTrip.boardingStopId);
      if (s) return { lat: s.lat, lng: s.lng };
    }
    if (selectedParada) return { lat: selectedParada.lat, lng: selectedParada.lng };
    return legacyBoardingStop;
  }, [resolvedTrip, selectedParada, legacyBoardingStop]);

  const hasTripContent = isTripMode || selectedVehiculo !== null || resolvedTrip !== null;
  const isTripViewActive = isTripMode && tripViewVisible;

  // (planificación movida arriba junto al resolver único)
  // Si cambia el trip, derivar el paso activo asegurando que pertenezca a la opción actual.
  const activeStepId = useMemo(() => {
    if (!selectedTrip || !selectedStepId) return null;
    return selectedTrip.steps.some((s) => s.id === selectedStepId) ? selectedStepId : null;
  }, [selectedTrip, selectedStepId]);

  // Fase step-focus: seleccionar un paso toma la cámara ('step-focus'); deseleccionar
  // restaura el follow del bondi/parada. El nonce re-dispara el fitBounds del paso.
  const handleSelectStep = useCallback((stepId: string | null) => {
    if (stepId) {
      setSelectedStepId(stepId);
      setStepFocusNonce((n) => n + 1);
      if (isTripMode && tripViewVisible) setCameraMode("step-focus");
      return;
    }
    setSelectedStepId(null);
    if (isTripMode && tripViewVisible) {
      setCameraMode(followTripStop ? "follow-trip" : "follow-vehicle");
      // Sin target de follow (sin bondi), re-encuadrar el trip entero.
      if (!selectedVehiculo) setTripReframeNonce((n) => n + 1);
    }
  }, [isTripMode, tripViewVisible, followTripStop, selectedVehiculo]);

  const effectiveHighlightLines = useMemo(() => {
    if (isTripMode) {
      return tripViewVisible && selectedTrip ? selectedTrip.highlightLines : [];
    }
    return regularHighlightLines;
  }, [isTripMode, tripViewVisible, selectedTrip, regularHighlightLines]);

  // PBI-034: cuando hay líneas filtradas (multi-filtro de Red Metropol o
  // single-line legacy), encuadrar la cámara al extent de sus recorridos.
  // Si no hay líneas o estamos en modo viaje, no forzamos focus. Es un useMemo
  // puro (no useEffect+setState) para evitar cascading renders; el nonce se
  // deriva de la concat ordenada de los ids (suma charCode) para que un cambio
  // del set (incluso manteniendo la misma cantidad) re-dispare el fitBounds
  // sin necesidad de mutar refs durante render.
  const effectiveLineaIds = useMemo(
    () => (lineaFilter.length > 0 ? lineaFilter : selectedLineaId ? [selectedLineaId] : []),
    [lineaFilter, selectedLineaId],
  );
  const lineaFilterFocus: MapFocusRequest | null = useMemo(() => {
    if (isTripMode) return null;
    // PBI-034 v10: el cliente quiere ver las líneas MUY DE CERCA. Subimos
    // maxZoom a 16 (casi nivel de calle) y bajamos el padding al mínimo.
    // Para extent chico (1 línea CABA, ~9 km) el zoom llega a 16. Para
    // extent grande (multi con 195, ~13 km de combinaciones) llega a ~13.
    //
    // Sin filtros (mount): bounds = línea 195 (Retiro → La Plata).
    // Con filtros: bounds = combinaciones (smart extent) o fallback a coords.
    const PADDING_DEFAULT: MapFocusRequest["padding"] = {
      top: 60, // header buscador + chip "4 líneas" (mínimo viable)
      bottom: 100, // bottom nav (mínimo viable)
      left: 40, // LineSelectorBar (compacto)
      right: 30, // controles zoom + share (mínimo viable)
    };
    // PBI-034 v15: fitBounds con padding interno para que la UI (header pill,
    // bottom nav, LineSelectorBar, controles) no tape los extremos del extent.
    // El cliente quiere ver las 4 líneas juntas: fitBounds elige el zoom
    // MÍNIMO tal que el extent quepa respetando el maxZoom como techo.
    // El centroide queda en el centro del extent (no zoom fijo a Constitución).
    const ZOOM_DESKTOP = 20;
    // En mobile, el viewport portrait (412x665dp post-UI) hace que el extent
    // ~13 km quepa a zoom ~10. Forzamos un maxZoom bajo para que se vea el
    // recorrido completo sin scrolls.
    const ZOOM_MOBILE_MAX = 11;
    const modePrefix = isMobileViewport ? "M" : "D";
    if (isMobileViewport) {
      if (effectiveLineaIds.length === 0) {
        const b = computeLinea195Bounds(DATASET);
        if (b) {
          return {
            bounds: b,
            nonce: `${modePrefix}-195`,
            padding: { top: 70, bottom: 100, left: 40, right: 30 },
            maxZoom: ZOOM_MOBILE_MAX,
          };
        }
        return null;
      }
      const b =
        computeCombinacionesBounds(effectiveLineaIds, DATASET) ??
        computeLineasBounds(effectiveLineaIds, DATASET);
      if (!b) return null;
      const idHash = effectiveLineaIds
        .slice()
        .sort()
        .reduce((acc, id) => acc + id.split("").reduce((a, c) => a + c.charCodeAt(0), 0), 1);
      return {
        bounds: b,
        nonce: `${modePrefix}-${idHash}`,
        padding: { top: 70, bottom: 100, left: 40, right: 30 },
        maxZoom: ZOOM_MOBILE_MAX,
      };
    }
    // DESKTOP: fitBounds con maxZoom como techo.
    if (effectiveLineaIds.length === 0) {
      const linea195Bounds = computeLinea195Bounds(DATASET);
      if (linea195Bounds) {
        return { bounds: linea195Bounds, nonce: `${modePrefix}-195`, padding: PADDING_DEFAULT, maxZoom: ZOOM_DESKTOP };
      }
      return null;
    }
    const bounds =
      computeCombinacionesBounds(effectiveLineaIds, DATASET) ??
      computeLineasBounds(effectiveLineaIds, DATASET);
    if (!bounds) return null;
    const idHash = effectiveLineaIds
      .slice()
      .sort()
      .reduce((acc, id) => acc + id.split("").reduce((a, c) => a + c.charCodeAt(0), 0), 1);
    return {
      bounds,
      nonce: `${modePrefix}-${idHash}`,
      padding: PADDING_DEFAULT,
      maxZoom: ZOOM_DESKTOP,
    };
  }, [isTripMode, effectiveLineaIds, isMobileViewport]);

  const plannerPoints: PlannerMapPoints | null = useMemo(() => {
    if (!isTripViewActive) return null;
    return {
      origin: originLocation ? { lat: originLocation.lat, lng: originLocation.lng } : null,
      destination: destinationLocation
        ? { lat: destinationLocation.lat, lng: destinationLocation.lng }
        : null,
    };
  }, [isTripViewActive, originLocation, destinationLocation]);

  const plannerPulse: PlannerMapPulse | null = useMemo(() => {
    if (!isTripViewActive) return null;
    // Paso "arrive" enfocado: pulso sobre la parada de descenso (mismo rojo
    // que el marcador 'alight' de trip-used-stops) para señal visual clara.
    if (activeStepId && selectedTrip) {
      const focusedStep = selectedTrip.steps.find((s) => s.id === activeStepId);
      if (focusedStep?.focusPoint) {
        return { lat: focusedStep.focusPoint.lat, lng: focusedStep.focusPoint.lng, color: "#EF4444" };
      }
    }
    if (!selectedTrip?.transferStopCoords) return null;
    return {
      lat: selectedTrip.transferStopCoords.lat,
      lng: selectedTrip.transferStopCoords.lng,
      color: selectedTrip.transferStopCoords.color || "#06B6D4",
    };
  }, [isTripViewActive, selectedTrip, activeStepId]);

  const resolvedTripUsedStopIds = useMemo(() => {
    if (!resolvedTrip?.boardingStopId) return selectedTrip?.usedStopIds ?? null;
    return [
      resolvedTrip.boardingStopId,
      ...resolvedTrip.trip.usedStopIds.filter((stopId) => stopId !== resolvedTrip.boardingStopId),
    ];
  }, [resolvedTrip, selectedTrip]);

  /** Foco de llegada pendiente (?parada+?linea legacy): se resuelve al llegar el feed. */
  const pendingArrivalFocusRef = useRef<{ stopId: string; lineaId: string } | null>(null);

  /** Encuadre al elegir origen/destino (geocoder) cuando aún no hay trip. */
  const selectionFocusNonce = useRef(0);
  const lastFocusKeyRef = useRef<string | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<{ bounds: [[number, number], [number, number]]; nonce: number } | null>(null);

  // La deduplicación del foco y el nonce NO pueden vivir en el memo de
  // focusRequest (los refs durante render violan react-hooks/refs: React puede
  // repetir o descartar renders). El encuadre se deriva acá por estado: cada
  // punto nuevo emite un request con nonce creciente; un punto repetido no
  // re-dispara (misma clave) y el rAF difiere el setState para no cascadear.
  useEffect(() => {
    if (!isTripMode || selectedTrip) return;
    const target = destinationLocation ?? originLocation;
    if (!target) return;
    const key = `${target.name}|${target.lat.toFixed(5)}|${target.lng.toFixed(5)}`;
    if (lastFocusKeyRef.current === key) return;
    lastFocusKeyRef.current = key;
    const bounds =
      target.focusBounds ??
      ([
        [target.lng - 0.004, target.lat - 0.004],
        [target.lng + 0.004, target.lat + 0.004],
      ] as [[number, number], [number, number]]);
    const frame = window.requestAnimationFrame(() => {
      selectionFocusNonce.current += 1;
      setSelectionFocus({ bounds, nonce: selectionFocusNonce.current });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isTripMode, selectedTrip, destinationLocation, originLocation]);

  const focusRequest: MapFocusRequest | null = useMemo(() => {
    // PBI-034: fuera de modo viaje, si hay líneas filtradas, encuadrar al extent.
    if (!isTripMode) return lineaFilterFocus;

    if (!selectedTrip) {
      // Sin trip aún: encuadre del punto elegido (emitido por el efecto de arriba).
      const target = destinationLocation ?? originLocation;
      if (!target || !selectionFocus) return null;
      return { ...selectionFocus, bottomPadding: tripBottomPadding };
    }

    // Si hay un paso seleccionado, enfocar su geometría en vez del trip entero.
    if (activeStepId) {
      const step = selectedTrip.steps.find((s) => s.id === activeStepId);
      const leg = step?.legIndex !== undefined ? selectedTrip.legs[step.legIndex] : undefined;
      const coords = leg?.segmentCoordinates;
      if (coords && coords.length >= 2) {
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (const [lng, lat] of coords) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        // Padding mínimo para que el segmento no quede pegado al borde.
        const padLng = Math.max((maxLng - minLng) * 0.3, 0.004);
        const padLat = Math.max((maxLat - minLat) * 0.3, 0.004);
        // 3D: inclinar en la dirección de avance del segmento; 2D: plano al norte.
        const pitch = trip3D ? 52 : 0;
        const bearing = pitch ? segmentBearing(coords) : 0;
        return {
          bounds: [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]],
          nonce: stepFocusNonce,
          bottomPadding: tripBottomPadding,
          pitch,
          bearing,
          maxZoom: STEP_FOCUS_MAX_ZOOM,
        };
      }
      // Paso final "arrive" (sin leg de geometría): encuadre de la parada de
      // descenso + el destino juntos, para ver dónde bajar y a dónde se llega.
      if (step?.focusPoint) {
        const dest = selectedTrip.destinationCoords;
        const minLng = Math.min(step.focusPoint.lng, dest.lng);
        const maxLng = Math.max(step.focusPoint.lng, dest.lng);
        const minLat = Math.min(step.focusPoint.lat, dest.lat);
        const maxLat = Math.max(step.focusPoint.lat, dest.lat);
        const padLng = Math.max((maxLng - minLng) * 0.6, 0.0035);
        const padLat = Math.max((maxLat - minLat) * 0.6, 0.0035);
        return {
          bounds: [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]],
          nonce: stepFocusNonce,
          bottomPadding: tripBottomPadding,
          pitch: trip3D ? 40 : 0,
          bearing: 0,
          maxZoom: STEP_FOCUS_MAX_ZOOM,
        };
      }
    }
    // Sin paso activo y con un bondi elegido, el follow (bondi+parada) manda la
    // cámara: emitir el encuadre del trip entero pisaría ese restore al
    // deseleccionar (flash de trip completo). El trip entero solo se encuadra sin
    // target de follow (carga inicial sin vehículo) o en el fallback de un paso
    // sin geometría (REQ-8, activeStepId todavía presente).
    if (!activeStepId && selectedVehiculo) return null;
    const nonce =
      selectedTrip.id
        .split("")
        .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 1) + tripReframeNonce;
    return {
      bounds: selectedTrip.bounds,
      nonce,
      bottomPadding: tripBottomPadding,
    };
  }, [isTripMode, lineaFilterFocus, selectedTrip, activeStepId, originLocation, destinationLocation, selectionFocus, tripReframeNonce, tripBottomPadding, stepFocusNonce, trip3D, selectedVehiculo]);

  /** Selección explícita del usuario → limpia la clave de focus para que
   *  el geocoder pueda re-encuadrar (el seed de apertura no). */
  const handleSelectOrigin = useCallback((loc: LocationPoint) => {
    lastFocusKeyRef.current = null;
    // Nuevo origen = nuevo viaje: se invalidan las preferencias del anterior.
    setBoardingPin(null);
    setVehiclePin(null);
    setBoardingUnitKey(null);
    setOriginLocation(loc);
  }, []);

  const handleSelectDestination = useCallback((loc: LocationPoint) => {
    lastFocusKeyRef.current = null;
    setBoardingPin(null);
    setVehiclePin(null);
    setBoardingUnitKey(null);
    setDestinationLocation(loc);
  }, []);

  // Botón circular de ubicación real: pide permiso al navegador (debe salir de un
  // gesto del usuario en iOS/Android) y guarda el fix como origen del viaje.
  const handleUseDeviceLocation = useCallback(async () => {
    setGeoError(null);
    setGeoLoading(true);
    try {
      const loc = await requestDeviceLocation();
      handleSelectOrigin({ name: loc.name, lat: loc.lat, lng: loc.lng, isArbitrary: true, source: "text" });
    } catch (error) {
      setGeoError(error instanceof DeviceLocationError ? error.message : "No pudimos obtener tu ubicación.");
    } finally {
      setGeoLoading(false);
    }
  }, [handleSelectOrigin]);

  // sdd/trip-options-upgrade 2.3: el colapso del panel re-encuadra (expand Y collapse).
  const handlePanelCollapsedChange = useCallback((collapsed: boolean) => {
    setIsTripPanelCollapsed(collapsed);
    setTripReframeNonce((n) => n + 1);
    // Con un paso enfocado, re-encuadrarlo con el nuevo aire inferior (REQ-7).
    if (activeStepId && cameraMode === "step-focus") setStepFocusNonce((n) => n + 1);
  }, [activeStepId, cameraMode]);

  // sdd/trip-options-upgrade 3.1: tap en fila de abordaje → unidad concreta en el mapa.
  // SetState directo (como handleBusSelect): bypass del resolver congelado durante
  // dwell/ride. El reset de latch/dwell/onboard/rideStops sigue siendo SOLO via
  // arrivalResetKey (3.3) — acá no se toca latchedArriving/onboard/rideStops.
  const handleSelectBoardingOption = useCallback((unitKey: string) => {
    setBoardingUnitKey(unitKey);
    // Intención explícita: elegir otra opción libera el foco de paso (REQ-4).
    setSelectedStepId(null);
    const sep = unitKey.lastIndexOf("-");
    const lineId = sep > 0 ? unitKey.slice(0, sep) : unitKey;
    const unitId = sep > 0 ? unitKey.slice(sep + 1) : unitKey;
    const vehicle = positions.find((p) => p.lineId === lineId && p.unitId === unitId);
    if (!vehicle) {
      // Sin telemetría aún: el resolver unit-keyed la tomará cuando llegue el feed.
      setVehiclePin({ lineId, unitId, forTripKey: tripKey });
      return;
    }
    setSelectedVehiculo(vehicle);
    setTripViewVisible(true);
    setVehiclePin({ lineId: vehicle.lineId, unitId: vehicle.unitId, forTripKey: tripKey });
    setSelectedLineaId(vehicle.lineId);
    setSelectedRamalId(vehicle.ramalId || null);
    setCameraMode("follow-trip");
    setTripReframeNonce((n) => n + 1);
  }, [positions, tripKey]);

  // sdd/trip-options-upgrade 2.5 (panel): re-pick de destino sin perder el origen.
  const handleRepickDestination = useCallback(() => {
    setBoardingPin(null);
    setVehiclePin(null);
    setBoardingUnitKey(null);
    setSelectedTripId(null);
    setDestinationLocation(null);
    lastFocusKeyRef.current = null;
  }, []);

  const handleStartMapPick = useCallback((target: "origin" | "destination") => {
    setMapPickTarget(target);
    setIsLineMenuOpen(false);
  }, []);

  const handleCancelMapPick = useCallback(() => {
    setMapPickTarget(null);
  }, []);

  const handleMapPick = useCallback(
    (lngLat: [number, number]) => {
      if (!mapPickTarget) return;
      const [lng, lat] = lngLat;
      const point = TripPlannerService.createMapLocationPoint(
        lat,
        lng,
        mapPickTarget === "origin" ? "Origen" : "Destino"
      );
      if (mapPickTarget === "origin") {
        lastFocusKeyRef.current = null;
        setOriginLocation(point);
      } else {
        lastFocusKeyRef.current = null;
        setDestinationLocation(point);
      }
      setMapPickTarget(null);
    },
    [mapPickTarget]
  );

  const handleSwapPoints = useCallback(() => {
    lastFocusKeyRef.current = null;
    setBoardingPin(null);
    setVehiclePin(null);
    setBoardingUnitKey(null);
    setOriginLocation(destinationLocation);
    setDestinationLocation(originLocation);
  }, [originLocation, destinationLocation]);

  const handleClearTripMode = useCallback(() => {
    setOriginLocation(null);
    setDestinationLocation(null);
  }, []);

  const handleCloseTripMode = useCallback(() => {
    setTripViewVisible(false);
    // Cerrar el viaje no debe conservar un paso enfocado (REQ-6).
    setSelectedStepId(null);
    setCameraMode("overview");
  }, []);

  // ESC con jerarquía: cancelar "fijar en mapa" → salir de Modo Viaje.
  // Si el ESC se originó en un campo del ViajeHeader, ya hizo stopPropagation allí.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTripMode) return;
      if (mapPickTarget) {
        setMapPickTarget(null);
        return;
      }
      handleCloseTripMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTripMode, mapPickTarget, handleCloseTripMode]);

  /** Al abrir Modo Viaje, el origen simulado es real (no solo texto de UI).
   *  Pre-marca lastFocusKeyRef para que el seed NO dispare fitBounds
   *  (evita salto de cámara al abrir el modal). */
  const handleOpenTripMode = useCallback(() => {
    setIsTripMode(true);
    setTripViewVisible(true);
    setTrip3D(true);
    setOriginLocation((prev) => {
      if (prev) return prev;
      const seed = TripPlannerService.resolveLocationPoint(SIMULATED_USER_LOCATION.name);
      if (seed) {
        lastFocusKeyRef.current = `${seed.name}|${seed.lat.toFixed(5)}|${seed.lng.toFixed(5)}`;
      }
      return seed ?? prev;
    });
  }, []);

  // Restore the portable Home/Mi Viaje URL contract. Do not clear it: refresh
  // and shared links must reopen the exact selected demo trip.
  // NOTA zoom: no se selecciona la parada acá a propósito — el encuadre lo
  // maneja el follow-trip (planeo único al dual bondi+parada). Seleccionarla
  // dispararía el flyTo de parada y pelearía con el follow cada segundo.
  useEffect(() => {
    const request = parseTripMapState(new URLSearchParams(window.location.search));
    if (!request) return;
    const resolvedOrigin = request.origin.stopId
      ? TripPlannerService.resolveLocationPoint(request.origin.stopId)
      : TripPlannerService.resolveLocationPoint(request.origin.name);
    const origin = resolvedOrigin ?? (request.origin.lat !== 0 && request.origin.lng !== 0 ? request.origin : null);
    const destination = TripPlannerService.resolveLocationPoint(request.destinationName);
    if (!origin || !destination) return;
    // En desarrollo React ejecuta el ciclo del effect dos veces: el primer
    // cleanup cancela este frame y el segundo debe poder reprogramarlo. Un
    // guard persistente acá deja la URL marcada como leída sin aplicar nada.
    const frame = window.requestAnimationFrame(() => {
      setTripSeed(request);
      setIsTripMode(true);
      setTrip3D(true);
      setOriginLocation(origin);
      setDestinationLocation(destination);
      setSelectedTripId(request.selectedTripId ?? null);
      setSelectedLineaId(request.lineId ?? null);
      setSelectedRamalId(request.ramalId ?? null);
      // `paso` (deep-link a un paso, ej. la bajada desde /viaje): enfoca esa
      // sección del mapa apenas el trip se resuelve. Si el id no existe en la
      // opción elegida, activeStepId lo descarta y vuelve el follow normal.
      if (request.stepId) {
        setSelectedStepId(request.stepId);
        setStepFocusNonce((n) => n + 1);
        setCameraMode("step-focus");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Resolución única: elige la unidad concreta del trip resuelto y la sigue.
  // Prioridad: unidad tapeada (boardingUnitKey) > pin manual vigente > unidad
  // semilla (mismo trip) > llegada más próxima.
  // Si la vista está oculta (rosa/X) se actualiza el estado pero no se toca la cámara.
  // No compite con el focus legacy: ese cede en cuanto hay selectedTrip.
  // CONGELADO durante el abordaje y el viaje a bordo (sdd/trip-arrival-alert
  // hotfix): desde el primer hit del epsilon ARRIBANDO (`latchedArriving`) y
  // durante todo el ride (`onboard`), el auto-selector next-ETA queda FROZEN.
  // Sin esto, en el primer tick pasado la parada el bondi abordado envuelve a
  // distAhead≈totalM y `arrivals[0]` elige OTRO colectivo lejano (card blanca
  // "X min" + salto de cámara follow-trip al sur). La llave llega con 5s de
  // dwell + 2.5s de transfer + VIAJANDO green→yellow antes de liberar. Los taps
  // manuales no pasan por este resolver (handleBusSelect hace setState
  // directo), así que la intención explícita del usuario sigue funcionando.
  useEffect(() => {
    if (onboard || latchedArriving) return;
    if (!resolvedTrip?.boardingStopId || !resolvedTrip.lineId || positions.length === 0) return;
    const pin = vehiclePin && vehiclePin.forTripKey === resolvedTrip.key ? vehiclePin : null;
    if (pin && pin.unitId === MANUAL_NONE_UNIT) return; // descarte explícito del usuario

    // Unidad tapeada (cualquier línea de la parada): resolver contra TODAS las
    // llegadas — no solo la línea recomendada — y NUNCA caer a arrivals[0]. Sin
    // esto, la fila other-line quedaba fuera del filtro por línea, el target caía
    // a la llegada más próxima y el mapa elegía el colectivo equivocado.
    if (boardingUnitKey) {
      const stopArrivals = TransportService.getLlegadasPorParada(resolvedTrip.boardingStopId, positions);
      const tapped = stopArrivals.find((a) => boardingUnitKeyOf(a.lineaId, a.interno) === boardingUnitKey);
      if (!tapped) return; // sin telemetría aún: se resuelve cuando llegue el feed
      if (selectedVehiculo?.lineId === tapped.lineaId && selectedVehiculo?.unitId === tapped.interno) return;
      const tappedVehicle = positions.find((p) => p.lineId === tapped.lineaId && p.unitId === tapped.interno);
      if (!tappedVehicle) return;
      const tappedFrame = window.requestAnimationFrame(() => {
        setSelectedVehiculo(tappedVehicle);
        setSelectedLineaId(tappedVehicle.lineId);
        setSelectedRamalId(tappedVehicle.ramalId || null);
        if (tripViewVisible && !activeStepId) setCameraMode(resolvedTrip.boardingStopId ? "follow-trip" : "follow-vehicle");
      });
      return () => window.cancelAnimationFrame(tappedFrame);
    }

    const arrivals = TransportService.getLlegadasPorParada(
      resolvedTrip.boardingStopId,
      positions.filter((position) => position.lineId === resolvedTrip.lineId),
    );
    if (arrivals.length === 0) return;
    let target = pin && pin.unitId !== MANUAL_NONE_UNIT
      ? arrivals.find((a) => a.interno === pin.unitId)
      : undefined;
    if (!target && tripSeed?.vehicleUnitId && tripSeed.selectedTripId === resolvedTrip.trip.id) {
      target = arrivals.find((a) => a.interno === tripSeed.vehicleUnitId);
    }
    target ??= arrivals[0];
    if (!target) return;
    if (selectedVehiculo?.lineId === target.lineaId && selectedVehiculo?.unitId === target.interno) return;
    const vehicle = positions.find((p) => p.lineId === target.lineaId && p.unitId === target.interno);
    if (!vehicle) return;
    const frame = window.requestAnimationFrame(() => {
      setSelectedVehiculo(vehicle);
      setSelectedLineaId(vehicle.lineId);
      setSelectedRamalId(vehicle.ramalId || null);
      if (!tripViewVisible) return;
      if (!activeStepId) setCameraMode(resolvedTrip.boardingStopId ? "follow-trip" : "follow-vehicle");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resolvedTrip, positions, vehiclePin, tripSeed, tripViewVisible, selectedVehiculo, onboard, latchedArriving, boardingUnitKey, activeStepId]);

  // Resuelve el foco de llegada legacy: con el feed ya cargado, elige la unidad
  // con ETA más próxima de la línea en esa parada y la sigue (pill + cámara).
  // Solo actúa si el usuario aún no seleccionó otro vehículo manualmente y si
  // el trip resuelto no tomó el control (ese manda).
  useEffect(() => {
    if (selectedTrip) {
      pendingArrivalFocusRef.current = null;
      return;
    }
    const pending = pendingArrivalFocusRef.current;
    if (!pending || positions.length === 0 || selectedVehiculo) return;
    const arrivals = TransportService.getLlegadasPorParada(
      pending.stopId,
      positions.filter((p) => p.lineId === pending.lineaId),
    );
    const next = arrivals[0];
    if (!next) return;
    const vehicle = positions.find(
      (p) => p.lineId === next.lineaId && p.unitId === next.interno,
    );
    if (!vehicle) return;
    pendingArrivalFocusRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      setSelectedVehiculo(vehicle);
      setSelectedLineaId(vehicle.lineId);
      setSelectedRamalId(vehicle.ramalId || null);
      // La parada de abordaje es conocida (pending): encuadre dual bondi+parada.
      setCameraMode("follow-trip");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [positions, selectedVehiculo, selectedTrip]);

  // URL bidireccional: el mapa re-publica el trip resuelto para refresh/compartir.
  // Solo cambios estructurales (se ignoran etaMin/etaRef vivos para no hacer churn).
  useEffect(() => {
    if (!resolvedTrip || !originLocation || !destinationLocation) return;
    const state = buildTripMapState(resolvedTrip.trip, originLocation, {
      boardingStopId: resolvedTrip.boardingStopId,
      arrival: expectedArrival ?? undefined,
      stepId: activeStepId ?? undefined,
    });
    const structural: Array<[string, string | undefined]> = [
      ["origen", state.origin.name],
      ["destino", state.destinationName],
      ["paradaSubida", state.boardingStopId],
      ["opcion", state.selectedTripId],
      ["linea", state.lineId],
      ["ramal", state.ramalId],
      ["interno", state.vehicleUnitId],
      ["paso", state.stepId],
    ];
    const current = new URLSearchParams(window.location.search);
    if (current.get("trip") !== "1") return; // legacy (?linea=) se deja como está
    const differs = structural.some(([k, v]) => (current.get(k) ?? undefined) !== v);
    if (!differs) return;
    window.history.replaceState(null, "", tripMapUrlFromState(state));
  }, [resolvedTrip, originLocation, destinationLocation, expectedArrival, activeStepId]);

  // Salir de la vista de viaje (rosa/X): oculta el chrome y libera la cámara,
  // pero conserva viaje, vehículo, parada y línea intactos.
  const handleExitTripView = useCallback(() => {
    setTripViewVisible(false);
    // Salir de la vista libera el foco de paso (REQ-6).
    setSelectedStepId(null);
    setCameraMode("overview");
  }, []);

  // Re-entrar a la vista de viaje (rosa): restaura el chrome y re-encuadra la
  // sección importante (bondi+parada en legacy, bounds del trip en modo Viaje).
  const handleEnterTripView = useCallback(() => {
    setIsTripMode(true);
    setTripViewVisible(true);
    setTrip3D(true);
    // Re-entrar no debe restaurar un paso enfocado stale (REQ-6).
    setSelectedStepId(null);
    setTripReframeNonce((n) => n + 1);
    if (selectedVehiculo) {
      setCameraMode(followTripStop ? "follow-trip" : "follow-vehicle");
    } else if (!isTripMode) {
      setCameraMode("overview");
    }
  }, [selectedVehiculo, followTripStop, isTripMode]);

  const handleToggleTripView = useCallback(() => {
    if (tripViewVisible) handleExitTripView();
    else handleEnterTripView();
  }, [tripViewVisible, handleExitTripView, handleEnterTripView]);

  const handleToggleLineMenu = useCallback(() => {
    setIsLineMenuOpen((prev) => !prev);
  }, []);

  const handleSelectParada = useCallback((parada: Parada) => {
    setSelectedParada(parada);
    // La parada elegida fija el abordaje del trip vigente; la unidad se re-resuelve.
    setBoardingPin({ stopId: parada.id, forTripKey: tripKey });
    setVehiclePin(null);
    setBoardingUnitKey(null);
    setSelectedVehiculo(null);
    setCameraMode("overview");
    setIsLineMenuOpen(true);
    setStopFocusNonce((n) => n + 1);
  }, [tripKey]);

  // Links legacy del home (?parada=<id>&linea=<id> o ?linea=<id> sola, sin trip):
  // aplican el filtro de línea/ramal, enfocan la parada con su bubble y, cuando
  // llega el feed de 1 Hz, auto-seleccionan la unidad más próxima para seguirla.
  // El contrato portable (trip=1) lo maneja su propio effect: acá se ignora.
  // El setState se difiere a un rAF: así no dispara cascadas de render en el mount
  // (regla react-hooks/set-state-in-effect) y sigue corriendo post-hidratación.
  //
  // PBI-034: ?lineas=line-65,line-109,... activa el multi-filtro desde Red Metropol.
  // Cualquier id que no exista en el dataset se descarta silenciosamente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("trip") === "1") return;
    const stopId = params.get("parada");
    const lineaId = params.get("linea");
    const lineasParam = params.get("lineas");
    const ramalId = params.get("ramal");
    if (!stopId && !lineaId && !lineasParam) return;

    const lineas = TransportService.getLineas();
    const lineasOk = lineasParam
      ? lineasParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id && lineas.some((l) => l.id === id))
      : [];
    const lineaOk = lineaId ? lineas.some((l) => l.id === lineaId) : false;
    const stop = stopId ? TripPlannerService.getStopById(stopId) : null;
    const ramalOk = !!(
      lineaOk && ramalId &&
      lineas
        .find((l) => l.id === lineaId)
        ?.ramalesDetalle?.some((r) => r.id === ramalId)
    );
    // Se conserva `linea`/`lineas`/`ramal` en la URL para que el refresh restaure el filtro;
    // solo `parada` se consume una vez (abre el bubble).
    const url = new URL(window.location.href);
    url.searchParams.delete("parada");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (!stop && !lineaOk && lineasOk.length === 0) return;
    if (stopId && (lineaOk || lineasOk.length > 0)) {
      pendingArrivalFocusRef.current = { stopId, lineaId: (lineaOk ? lineaId : lineasOk[0]) as string };
    }
    const legacyStopCoords = stop ? { lat: stop.lat, lng: stop.lng } : null;
    const raf = window.requestAnimationFrame(() => {
      if (legacyStopCoords) setLegacyBoardingStop(legacyStopCoords);
      if (lineasOk.length > 0) {
        setLineaFilter(lineasOk);
        // Mantener compat con LineSelectorBar: la primera línea del set es la "activa"
        // (la que se usa para ramales, color de header, camera follow, etc.).
        setSelectedLineaId(lineasOk[0] ?? null);
        setSelectedRamalId(null);
      } else if (lineaOk && lineaId) {
        setLineaFilter([lineaId]);
        setSelectedLineaId(lineaId);
        setSelectedRamalId(ramalOk && ramalId ? ramalId : null);
      }
      if (stop) handleSelectParada(stop);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [handleSelectParada]);

  // Entrada "Explorar mapa" desde Home (?explorar=1): muestra la orientación
  // del selector y consume el parámetro para no repetirla en un refresh.
  // rAF-deferred igual que el resto de los handoffs de esta página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("explorar") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("explorar");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const raf = window.requestAnimationFrame(() => setShowExploreHint(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const handleSelectStopById = useCallback((stopId: string) => {
    if (!stopId) {
      setSelectedParada(null);
      setBoardingPin(null);
      return;
    }
    const found = paradas.find((p) => p.id === stopId);
    if (found) {
      setSelectedParada((prev) => (prev?.id === stopId ? null : found));
      setBoardingPin((prev) =>
        prev?.stopId === stopId && prev.forTripKey === tripKey
          ? null
          : { stopId, forTripKey: tripKey },
      );
      setVehiclePin(null);
      setBoardingUnitKey(null);
      setSelectedVehiculo(null);
      setIsLineMenuOpen(true);
    } else {
      setSelectedParada(null);
      setBoardingPin(null);
    }
  }, [paradas, tripKey]);

  const handleSelectLinea = useCallback((lineaId: string | null) => {
    setSelectedLineaId(lineaId);
    setSelectedRamalId(null);
    setSelectedVehiculo(null);
    setSelectedParada(null);
    setCameraMode("overview");
    // Elegir una línea desde el rail es exploración: si veníamos de Viaje lo
    // cerramos para que se vea el recorrido (el highlight del viaje pisaría el
    // de la línea porque isTripMode los separa). El viaje queda conservado.
    // Solo al elegir (no al limpiar): el botón maestro del rail también limpia.
    if (isTripMode && lineaId) {
      setIsTripMode(false);
      setTripViewVisible(false);
      setSelectedStepId(null);
    }
  }, [isTripMode]);

  const handleSelectRamal = useCallback((ramalId: string | null) => {
    setSelectedRamalId(ramalId);
    setSelectedVehiculo(null);
    setSelectedParada(null);
    if (isTripMode && ramalId) {
      setIsTripMode(false);
      setTripViewVisible(false);
      setSelectedStepId(null);
      setCameraMode("overview");
    }
  }, [isTripMode]);

  const handleBusSelect = useCallback((pos: VehiclePosition | null) => {
    if (!pos) {
      // Descarte explícito: no re-resolver hasta que cambie el viaje.
      setVehiclePin({ lineId: "", unitId: MANUAL_NONE_UNIT, forTripKey: tripKey });
      setSelectedVehiculo(null);
      setSelectedStepId(null);
      setCameraMode("overview");
      return;
    }
    setSelectedVehiculo(pos);
    // Tap de bondi en el mapa: intención explícita que libera el foco de paso (REQ-4).
    setSelectedStepId(null);
    // Una selección explícita reabre la vista del viaje si estaba oculta
    // y fija la unidad hasta que cambie el viaje.
    setTripViewVisible(true);
    // sdd/trip-options-upgrade: map→panel sync — la fila correcta se resalta.
    setBoardingUnitKey(boardingUnitKeyOf(pos.lineId, pos.unitId));
    setVehiclePin({ lineId: pos.lineId, unitId: pos.unitId, forTripKey: tripKey });
    setSelectedLineaId(pos.lineId);
    // Al seleccionar un colectivo, se aísla exclusivamente su ramal y sus unidades
    setSelectedRamalId(pos.ramalId || null);
    setSelectedParada(null);
    setIsLineMenuOpen(false);
    // Con parada de abordaje en contexto (trip o legacy), encuadre dual.
    setCameraMode(followTripStop ? "follow-trip" : "follow-vehicle");
  }, [followTripStop, tripKey]);

  const handleToggle3D = useCallback(() => {
    if (isTripMode) {
      setTrip3D((v) => !v);
      // El toggle cambia la pose, pero no debe depender de que la cámara siga
      // actualmente en follow: un drag o una parada seleccionada pueden dejarla
      // en free/overview. Reafirmamos el contexto vigente sin limpiar nada.
      if (activeStepId) {
        setCameraMode("step-focus");
        setStepFocusNonce((n) => n + 1);
        return;
      }
      setCameraMode(followTripStop ? "follow-trip" : "follow-vehicle");
      return;
    }
    setCameraMode((prev) => (prev === "navigation-vehicle" ? "follow-vehicle" : "navigation-vehicle"));
  }, [isTripMode, activeStepId, followTripStop]);

  const handleResetCamera = useCallback(() => {
    setSelectedLineaId("line-65");
    setSelectedRamalId(null);
    setSelectedVehiculo(null);
    setSelectedParada(null);
    setCameraMode("overview");
  }, []);

  // ─── Trip sheet UI (sdd/trip-sheet-ui-fix + trip-options-upgrade) ──────
  // Dual padding (TRIP_PAD_*): keeps the bus marker + boarding circle above
  // the sheet collapsed (~160) or expanded (~514). fitBounds logic in MapCanvas
  // is untouched; solo cambia el aire inferior.
  // Zero-gap stack token: white card docks directly under the top pill.
  const TRIP_STACK_GAP = "0px";

  const hasActivePill = Boolean(selectedVehiculo || selectedRamal);
  // 3D activo: en Viaje lo controla `trip3D`; fuera, el modo navigation-vehicle.
  const is3DActive = isTripMode ? trip3D : cameraMode === "navigation-vehicle";
  const mapUnavailableHref = tripSeed ? tripJourneyUrlFromState(tripSeed) : "/inicio";
  const mapUnavailableLabel = tripSeed ? "Volver a la guía del viaje" : "Volver al inicio";

  // PBI-034: cuando entramos al mapa con ?lineas=line-65,line-109,... (multi-filtro
  // desde Red Metropol) mostramos un chip arriba con la cantidad + chips de línea,
  // y permitimos cerrarlo para volver al comportamiento single-line por defecto.
  const lineaFilterInfo = useMemo(() => {
    if (lineaFilter.length < 2) return null;
    const items = lineaFilter
      .map((id) => lineas.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));
    return { count: items.length, items };
  }, [lineaFilter, lineas]);

  const handleClearLineaFilter = useCallback(() => {
    setLineaFilter([]);
    // Mantener selectedLineaId con la primera para no perder la selección visual.
  }, []);

  return (
    <div className="relative w-full h-full min-h-dvh overflow-hidden bg-background text-foreground select-none">
      {/* Vista de Mapa Interactivo WebGL */}
      <main
          className="relative w-screen h-[100dvh] overflow-hidden select-none bg-canvas text-foreground touch-manipulation"
          style={{ "--map-ctrl-offset": hasActivePill ? "124px" : "58px", "--trip-stack-gap": TRIP_STACK_GAP } as React.CSSProperties}
        >
          {/* Header Flotante Superior: Búsqueda regular o Modo Viaje.
              SIN backdrop-blur: el filtro sobre el canvas WebGL re-composita
              cada frame y titilea al expandir el modal.
              SIN translateZ(0): forzar capa GPU en este header coplanaba
              el <canvas> WebGL del mapa en WebKit (Safari iOS) y lo dejaba
              en negro. Ver docs/INCIDENTE-MAPA-iOS-SAFARI.md. */}
          <div
            className="absolute top-[max(14px,env(safe-area-inset-top))] left-4 right-4 z-30 max-w-md mx-auto pointer-events-auto flex flex-col items-center gap-2"
          >
            {isTripViewActive ? (
<ViajeHeader
        originLocation={originLocation}
        destinationLocation={destinationLocation}
        onSelectOrigin={handleSelectOrigin}
        onSelectDestination={handleSelectDestination}
        onSwapPoints={handleSwapPoints}
        onClose={handleCloseTripMode}
        onClear={handleClearTripMode}
        userSimulatedLocationName={SIMULATED_LOCATION_LABEL}
        mapPickTarget={mapPickTarget}
        onStartMapPick={handleStartMapPick}
        onCancelMapPick={handleCancelMapPick}
        onUseDeviceLocation={handleUseDeviceLocation}
        geoLoading={geoLoading}
        geoError={geoError}
        initialCollapsed={Boolean(resolvedTrip)}
        collapseWhenComplete={Boolean(resolvedTrip)}
        onCollapsedChange={setIsTripHeaderCollapsed}
      />
            ) : (
              <div className="w-full flex flex-col items-center gap-2">
                {/* Barra principal de búsqueda con Lupita: acceso directo a Modo Viaje */}
                <button
                  type="button"
                  onClick={handleOpenTripMode}
                  title="Planificar viaje en transporte público"
                  aria-label="Abrir planificador de viaje"
                  className="w-full bg-canvas dark:bg-canvas border border-hairline rounded-full px-3.5 py-2 shadow-sm flex items-center justify-between text-left hover:bg-canvas-soft transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-7 h-7 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-text-muted group-hover:text-ink shrink-0">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-ink block leading-tight truncate">
                        ¿A dónde vas?
                      </span>
                      <span className="text-[10px] text-text-muted font-normal block truncate">
                        Buscá calles, lugares o paradas
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-electric-blue px-2.5 py-0.5 rounded-full bg-electric-blue/10 shrink-0">
                    Viaje
                  </span>
                </button>

                {/* Píldora del Colectivo Seleccionado (Multilínea en mobile para mostrar información completa) */}
                {tripViewVisible && selectedVehiculo && selectedVehicleInfo && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 w-full max-w-md px-3.5 py-2 rounded-2xl bg-canvas dark:bg-canvas border border-hairline shadow-md text-xs pointer-events-auto flex flex-col gap-1">
                    {/* Fila 1: Insignia, Línea, Ramal y botón Cerrar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-xs"
                          style={{
                            backgroundColor: selectedVehicleInfo.ramal?.color || selectedVehicleInfo.linea?.colorHex || "#1D4ED8",
                          }}
                        >
                          {selectedVehicleInfo.ramal ? getRamalLetter(selectedVehicleInfo.ramal) : (selectedVehicleInfo.linea?.numero || selectedVehiculo.lineId.replace("line-", ""))}
                        </span>
                        <span className="font-bold text-ink shrink-0">
                          {selectedVehicleInfo.linea ? `Línea ${selectedVehicleInfo.linea.numero}` : selectedVehiculo.lineId.replace("line-", "Línea ")}
                        </span>
                        {selectedVehicleInfo.ramal && (
                          <span className="text-text-muted font-medium shrink-0">
                            • {selectedVehicleInfo.ramal.codigo}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleExitTripView}
                        title="Salir de la vista de viaje (se conserva el viaje)"
                        aria-label="Ocultar vista de viaje"
                        className="w-5 h-5 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink shrink-0 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Fila 2: Próxima parada y tiempo estimado COMPLETO sin puntos suspensivos */}
                    {selectedVehicleInfo.nextStopName && selectedVehicleInfo.minutesToNextStop !== null && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#2f6b57] dark:text-[#8fcdb4] font-semibold pl-0.5 leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3f8a6f] animate-pulse shrink-0" />
                        <span>
                          Próxima parada: <span className="font-bold text-ink underline decoration-[#3f8a6f]/40 decoration-1 underline-offset-2">{selectedVehicleInfo.nextStopName}</span> (~{selectedVehicleInfo.minutesToNextStop} min)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Chip de multi-filtro desde Red Metropol (PBI-034).
                    Muestra las N líneas pre-seleccionadas con su color de marca
                    y permite cerrar el filtro para volver al modo single-line. */}
                {lineaFilterInfo && !isTripViewActive && (
                  <div
                    role="status"
                    aria-label={`Mostrando ${lineaFilterInfo.count} líneas: ${lineaFilterInfo.items.map((l) => l.numero).join(", ")}`}
                    className="animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-canvas border border-hairline shadow-md pointer-events-auto max-w-full"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted shrink-0">
                      {lineaFilterInfo.count} líneas
                    </span>
                    <div className="flex items-center gap-1 min-w-0 flex-wrap">
                      {lineaFilterInfo.items.map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: l.colorHex }}
                          title={l.nombre}
                          aria-label={`Línea ${l.numero}`}
                        >
                          {l.numero}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearLineaFilter}
                      title="Cerrar filtro de líneas"
                      aria-label="Cerrar filtro de líneas"
                      className="ml-0.5 w-5 h-5 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink shrink-0 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}

                {/* Píldora del Ramal Seleccionado (visible si no hay colectivo seleccionado) */}
                {!selectedVehiculo && selectedRamal && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-canvas dark:bg-canvas border border-hairline shadow-md text-xs pointer-events-auto max-w-full">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: selectedRamal.color || selectedLinea?.colorHex || "#1D4ED8" }}
                    >
                      {getRamalLetter(selectedRamal)}
                    </span>
                    <span className="font-bold text-ink shrink-0">
                      {selectedRamal.codigo}:
                    </span>
                    <span className="text-text-muted font-medium line-clamp-2 break-words min-w-0">
                      {getRamalDisplayName(selectedRamal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectRamal(null)}
                      title="Quitar filtro de ramal"
                      aria-label="Cerrar filtro de ramal"
                      className="ml-1 w-4 h-4 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink shrink-0 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selector Vertical Jerárquico de Líneas: visible en mapa normal y
              también en Modo Viaje (el rail baja para no chocar con el header). */}
          <LineSelectorBar
            lineas={lineas}
            selectedLineaId={selectedLineaId}
            selectedRamalId={selectedRamalId}
            onSelectLinea={handleSelectLinea}
            onSelectRamal={handleSelectRamal}
            hasTopPill={hasActivePill}
            tripMode={isTripMode}
          />

          {/* Orientación "Explorar mapa": coachmark descartable anclado al rail
              (mismo offset vertical que el botón de capas, sin taparlo). */}
          {showExploreHint && !isTripViewActive && !hasActivePill && (
            <div
              role="note"
              className="absolute left-14 z-30 w-[calc(100vw-152px)] max-w-[240px] animate-in fade-in slide-in-from-left-2 duration-300 top-[calc(max(14px,env(safe-area-inset-top))+62px)]"
            >
              <div className="flex items-start gap-1 rounded-2xl border border-hairline bg-canvas p-3 pr-1 shadow-lg">
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-electric-blue" aria-hidden="true" />
                <p className="flex-1 text-xs font-semibold leading-snug text-ink">
                  Elegí una línea para ver su recorrido y sus unidades en vivo.
                </p>
                <button
                  type="button"
                  onClick={() => setShowExploreHint(false)}
                  aria-label="Cerrar ayuda del selector de líneas"
                  className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-canvas-soft hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* Canvas de Mapa MapLibre WebGL — capa fija, sin reflow del header */}
          <div className={`absolute inset-0 overflow-hidden ${mapUnavailable ? "z-50" : "z-0"}`}>
            <DynamicMap
              positions={filteredPositions}
              highlightLines={effectiveHighlightLines}
              onBusSelect={handleBusSelect}
              onStopSelect={handleSelectStopById}
              selectedStopId={selectedParada?.id || null}
              stopFocusNonce={stopFocusNonce}
              selectedKey={selectedKey}
              cameraMode={cameraMode}
              onCameraModeChange={setCameraMode}
              trip3D={isTripMode ? trip3D : false}
              followTripStop={followTripStop}
              cameraBottomPadding={isTripMode ? tripBottomPadding : selectedParada ? 360 : 140}
              center={[-58.4250, -34.5950]}
              theme={resolvedTheme}
              focusRequest={focusRequest}
              plannerPoints={plannerPoints}
              plannerPulse={plannerPulse}
              tripSegments={isTripViewActive && selectedTrip ? selectedTrip.segments : null}
              tripRouteShade={isTripViewActive ? tripRouteShade : null}
              tripUsedStopIds={isTripViewActive && selectedTrip ? resolvedTripUsedStopIds : null}
              tripFocus={isTripViewActive && !!selectedTrip}
              tripPulseActive={arrivalPhase === 'VIAJANDO_GREEN' || arrivalPhase === 'VIAJANDO_YELLOW'}
              pickMode={Boolean(mapPickTarget)}
              onMapPick={handleMapPick}
              userLocation={userLocation}
              onMapReady={() => setMapUnavailable(false)}
              onMapUnavailable={() => setMapUnavailable(true)}
              className="w-full h-full"
              unavailableHref={mapUnavailableHref}
              unavailableLabel={mapUnavailableLabel}
            />
          </div>

          {isTripViewActive && isTripHeaderCollapsed && resolvedTrip && selectedVehiculo && (expectedArrival || onboard || arrivalPhase !== 'NORMAL') && cardLineaNumero && (
            <ArrivalStatusCard
              phase={arrivalPhase}
              minutes={arrivalMinutes}
              lineNumber={cardLineaNumero}
              nextStopName={selectedVehicleInfo?.nextStopName ?? undefined}
              onDismiss={handleExitTripView}
            />
          )}
          {/* Controles Flotantes en el Mapa */}
          <div
            className={`absolute right-4 z-20 flex flex-col gap-2 pointer-events-auto items-center w-10 transition-all duration-300 ease-out ${
              hasActivePill
                ? "top-[calc(max(14px,env(safe-area-inset-top))+250px)]"
                : "top-[calc(max(14px,env(safe-area-inset-top))+184px)]"
            }`}
          >
            <ThemeToggle />


            <button
              onClick={handleResetCamera}
              title="Centrar en Metropol"
              aria-label="Centrar vista en Metropol"
              className="w-10 h-10 rounded-full bg-canvas/95 border border-hairline flex items-center justify-center text-foreground hover:bg-canvas-soft active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {selectedVehiculo && (
              <button
                onClick={handleToggle3D}
                title={is3DActive ? "Cambiar a vista 2D" : "Volver a la vista 3D"}
                aria-label="Alternar modo 3D"
                className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-95 transition-all ${
                  is3DActive
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-canvas/95 text-foreground border-hairline hover:bg-canvas-soft"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}

              <button
              onClick={() => {
                setUserLocation((prev) =>
                  prev ? null : {
                    lat: SIMULATED_USER_LOCATION.lat,
                    lng: SIMULATED_USER_LOCATION.lng,
                    heading: SIMULATED_USER_LOCATION.heading ?? null,
                  }
                );
              }}
              title={userLocation ? "Desactivar mi ubicación simulada" : "Activar mi ubicación simulada (Parque Centenario)"}
              aria-label="Alternar mi posición simulada"
              className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-95 transition-all ${
                userLocation
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-canvas/95 text-text-muted border-hairline hover:bg-canvas-soft"
              }`}
            >
              <Navigation className={`w-4 h-4 ${userLocation ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Panel de Viaje o Burbuja Flotante según el modo activo */}
          {isTripViewActive ? (
            <ViajePanel
              options={tripOptions}
              selectedOptionId={selectedTrip?.id || null}
              onSelectOption={(id) => { setSelectedTripId(id); setSelectedStepId(null); setBoardingPin(null); setVehiclePin(null); setBoardingUnitKey(null); setTripReframeNonce((n) => n + 1); if (tripViewVisible) setCameraMode("follow-trip"); }}
              onClose={handleExitTripView}
              hasPointsSelected={Boolean(originLocation && destinationLocation)}
              originLocation={originLocation}
              destinationLocation={destinationLocation}
              selectedStepId={activeStepId}
              onSelectStep={handleSelectStep}
              boardingOptions={boardingOptions}
              selectedBoardingUnitKey={boardingUnitKey}
              onSelectBoardingOption={handleSelectBoardingOption}
              liveHeroLabel={boardingHeroLive}
              liveFooterLabel={expectedArrival?.displayLabel ?? boardingHeroLive}
              onCollapsedChange={handlePanelCollapsedChange}
              onRepickDestination={handleRepickDestination}
              userHeading={userLocation?.heading ?? null}
            />
          ) : (
            <LiveTransportBubble
              isOpen={isLineMenuOpen}
              onClose={() => setIsLineMenuOpen(false)}
              selectedLinea={selectedLinea}
              selectedRamal={selectedRamal}
              selectedParada={selectedParada}
              paradas={paradas}
              llegadas={llegadas}
              alertas={alertas}
              totalVehiculosActivos={filteredPositions.length}
              onSelectParada={handleSelectParada}
              selectedVehiculo={selectedVehiculo}
              cameraMode={cameraMode}
              onToggle3D={selectedVehiculo ? handleToggle3D : undefined}
              timelineStops={timelineStops}
              busProgress={busProgress}
              busAlongM={busAlongM}
            />
          )}
      </main>

      {/* Bottom nav unificado (sin Perfil) — Líneas abre el selector en /mapas */}
      <BottomNav
        isLineMenuOpen={isLineMenuOpen}
        onToggleLineMenu={handleToggleLineMenu}
        onActivateTripMode={handleOpenTripMode}
        isTripMode={isTripViewActive}
        arrivalPhase={isTripViewActive ? arrivalPhase : undefined}
        tripToggleActive={hasTripContent}
        onToggleTripView={handleToggleTripView}
      />
    </div>
  );
}
