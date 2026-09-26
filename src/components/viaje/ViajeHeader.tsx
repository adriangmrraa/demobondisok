"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowUpDown, X, Search, Navigation, CornerDownLeft, ChevronDown, Crosshair, Eraser } from "lucide-react";
import { LocationPoint } from "@/types/trip-planner";
import { TripPlannerService, KNOWN_POIS } from "@/lib/services/trip-planner-service";
import { SIMULATED_USER_LOCATION } from "@/lib/config/user-location";
import { useDragCollapse } from "@/lib/hooks/use-drag-collapse";

interface ViajeHeaderProps {
  originLocation: LocationPoint | null;
  destinationLocation: LocationPoint | null;
  onSelectOrigin: (location: LocationPoint) => void;
  onSelectDestination: (location: LocationPoint) => void;
  onSwapPoints: () => void;
  onClose: () => void;
  userSimulatedLocationName?: string;
  onStartMapPick?: (target: "origin" | "destination") => void;
  mapPickTarget?: "origin" | "destination" | null;
  onCancelMapPick?: () => void;
  onClear?: () => void;
  initialCollapsed?: boolean;
  collapseWhenComplete?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** sdd/trip-arrival-alert: pulses the minimized pill after PASSED handoff. */
  arrivalPulse?: boolean;
  /** sdd/trip-arrival-alert Phase 7: yellow color-sync with the VIAJANDO card
   * while riding. Same yellow token + same 1.2s rhythm as the card; pill stays
   * on top, card stays docked — they combine BY COLOR only. Takes precedence
   * over `arrivalPulse` when both are true. */
  arrivalRideSync?: boolean;
  /** Replays the physical handoff when the vehicle boards. */
  arrivalHandoff?: boolean;
}

export default function ViajeHeader({
  originLocation,
  destinationLocation,
  onSelectOrigin,
  onSelectDestination,
  onSwapPoints,
  onClose,
  userSimulatedLocationName,
  onStartMapPick,
  mapPickTarget,
  onCancelMapPick,
  onClear,
  initialCollapsed = false,
  collapseWhenComplete = false,
  onCollapsedChange,
  arrivalPulse = false,
  arrivalRideSync = false,
  arrivalHandoff = false,
}: ViajeHeaderProps) {
  const [activeField, setActiveField] = useState<"origin" | "destination" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Debounce: el geocoder local corre en el hilo principal; sin él,
  // cada keystroke re-renderiza el dropdown y contiende el main thread
  // con el mapa WebGL de fondo (parpadeo / jank).
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { collapsed, setCollapsed, toggle, handleProps } = useDragCollapse(initialCollapsed);

  useEffect(() => {
    if (collapseWhenComplete && originLocation && destinationLocation) {
      setCollapsed(true);
    }
  }, [collapseWhenComplete, originLocation, destinationLocation, setCollapsed]);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setDebouncedQuery("");
      return;
    }
    const t = window.setTimeout(() => setDebouncedQuery(q), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const filteredLocations = useMemo(
    () => TripPlannerService.searchLocations(debouncedQuery),
    [debouncedQuery],
  );

  useEffect(() => {
    if (activeField && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeField]);

  const handleSelect = useCallback(
    (loc: LocationPoint) => {
      if (activeField === "origin") {
        onSelectOrigin(loc);
        setActiveField(null);
        setSearchQuery("");
      } else if (activeField === "destination") {
        onSelectDestination(loc);
        setActiveField(null);
        setSearchQuery("");
      }
    },
    [activeField, onSelectOrigin, onSelectDestination]
  );

  const handleConfirmFreeText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      const resolved = TripPlannerService.resolveLocationPoint(clean);
      if (resolved) {
        handleSelect(resolved);
        return;
      }

      const fallbackPoint: LocationPoint = {
        name: clean,
        address: clean,
        lat: SIMULATED_USER_LOCATION.lat,
        lng: SIMULATED_USER_LOCATION.lng,
        isArbitrary: true,
        source: "text",
      };
      handleSelect(fallbackPoint);
    },
    [handleSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Geocoder en vivo (sin esperar el debounce de 300ms) para Enter.
      const live = searchQuery.trim()
        ? TripPlannerService.searchLocations(searchQuery)
        : [];
      if (live.length > 0) {
        handleSelect(live[0]);
      } else {
        handleConfirmFreeText(searchQuery);
      }
    } else if (e.key === "Escape") {
      // El ESC solo cierra el campo activo: sin stopPropagation el evento
      // sigue burbujeando al listener de window y cerraría todo el Modo Viaje.
      e.stopPropagation();
      setActiveField(null);
      setSearchQuery("");
    }
  };

  // ─── Modo Activo de Selección en el Mapa (Map Picker) ───────────────────
  if (mapPickTarget) {
    const isOrigin = mapPickTarget === "origin";
    return (
      <div className="relative w-full max-w-md mx-auto pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200">
        <div className="bg-canvas dark:bg-canvas border-2 border-electric-blue rounded-[26px] p-3.5 shadow-[0_16px_45px_-6px_rgba(0,102,255,0.3)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-full bg-electric-blue text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Crosshair className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="text-xs font-black text-ink block leading-tight truncate">
                Fijar {isOrigin ? "Origen" : "Destino"} en el mapa
              </span>
              <span className="text-[11px] text-text-muted font-medium block truncate mt-0.5">
                Tocá cualquier punto del mapa para obtener sus coordenadas
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelMapPick}
            className="px-3 py-1.5 rounded-full bg-canvas-soft hover:bg-field border border-hairline text-xs font-bold text-ink shrink-0 transition-all active:scale-95"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const showCompact = collapsed && originLocation && destinationLocation && !activeField && !mapPickTarget;

  return (
    <div className="relative w-full max-w-md mx-auto pointer-events-auto">
      {/* Vista compacta al contraer: origen → destino en una línea */}
      {showCompact && (
        <div
          data-arrival-pill={arrivalPulse || arrivalRideSync ? "true" : undefined}
          data-arrival-ride={arrivalRideSync ? "true" : undefined}
          data-arrival-handoff={arrivalHandoff ? "true" : undefined}
          className={`bg-canvas dark:bg-canvas border border-hairline rounded-full pl-4 pr-2 py-2 shadow-md flex items-center gap-2 select-none${arrivalRideSync ? " pill-ride-sync" : arrivalPulse ? " pill-pulse" : ""}${arrivalHandoff ? " pill-handoff" : ""}`}
          {...handleProps}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            toggle();
          }}
          title="Expandir"
        >
          {arrivalHandoff && (
            <span aria-hidden="true" className="pill-impact">
              <span className="pill-impact__ripple" />
              <span className="pill-impact__flash" />
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-electric-blue shrink-0" />
          <span className="text-xs font-bold text-ink truncate flex-1">
            {originLocation?.name} → {destinationLocation?.name}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="w-7 h-7 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink shrink-0"
            aria-label="Expandir"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      )}
      {/* Tarjeta principal con campos de Origen y Destino */}
      {!showCompact && (
      <div className="bg-canvas dark:bg-canvas border border-hairline rounded-[26px] p-3 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18)] dark:shadow-[0_14px_40px_-6px_rgba(0,0,0,0.7)]">
        <div
          className="flex items-center justify-between pb-2 mb-2 border-b border-hairline-soft px-1 select-none"
          {...handleProps}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            toggle();
          }}
          title={collapsed ? "Expandir" : "Contraer"}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-electric-blue animate-pulse" />
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Modo Viaje
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </div>
          {/* Grupo acciones: Limpiar (secundaria) · Cerrar X (convención: borde derecho) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={!originLocation && !destinationLocation}
                className="w-8 h-8 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                title="Limpiar campos"
                aria-label="Limpiar origen y destino"
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-text-muted hover:text-ink transition-colors active:scale-95"
              title="Salir de modo Viaje"
              aria-label="Cerrar modo Viaje"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicadores visuales verticales de ruta */}
          <div className="flex flex-col items-center justify-between self-stretch py-2.5 shrink-0 w-4">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-electric-blue bg-canvas flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-electric-blue" />
            </div>
            <div className="w-0.5 flex-1 bg-hairline my-1 border-dashed" />
            <div className="w-3.5 h-3.5 rounded-full bg-ink flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-canvas" />
            </div>
          </div>

          {/* Inputs de Origen y Destino */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Campo Origen */}
            <div className="relative flex items-center">
              {activeField === "origin" ? (
                <div className="w-full flex items-center bg-field rounded-[16px] px-3 py-1.5 border border-ink/20">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Escribí calle o lugar (ej: Cabildo, Obelisco)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-text-faint focus:outline-none"
                  />
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => handleConfirmFreeText(searchQuery)}
                      className="text-electric-blue hover:opacity-80 p-0.5 mr-1"
                      title="Confirmar origen"
                      aria-label="Confirmar origen"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveField(null);
                      setSearchQuery("");
                    }}
                    className="text-text-muted hover:text-ink p-0.5"
                    aria-label="Cerrar campo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-full flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveField("origin");
                      setSearchQuery(originLocation?.name || "");
                    }}
                    className="flex-1 flex items-center justify-between text-left bg-field/70 hover:bg-field rounded-[16px] px-3 py-1.5 transition-colors group min-w-0"
                  >
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-text-muted font-medium block leading-none">
                        ¿Desde dónde?
                      </span>
                      <span className="text-xs font-bold text-ink truncate block mt-0.5">
                        {originLocation?.name || userSimulatedLocationName || "Seleccionar punto de partida"}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-electric-blue shrink-0 group-hover:underline">
                      {originLocation ? "Cambiar" : "Escribir"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartMapPick?.("origin")}
                    title="Fijar origen en el mapa"
                    aria-label="Elegir origen en el mapa"
                    className="px-2.5 py-2 rounded-[16px] bg-canvas-soft hover:bg-field border border-hairline text-text-muted hover:text-ink text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow-xs"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-electric-blue" />
                    <span className="hidden xs:inline">En mapa</span>
                  </button>
                </div>
              )}
            </div>

            {/* Campo Destino */}
            <div className="relative flex items-center">
              {activeField === "destination" ? (
                <div className="w-full flex items-center bg-field rounded-[16px] px-3 py-1.5 border border-ink/20">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Escribí destino (ej: Obelisco, Av. Corrientes)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-text-faint focus:outline-none"
                  />
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => handleConfirmFreeText(searchQuery)}
                      className="text-electric-blue hover:opacity-80 p-0.5 mr-1"
                      title="Confirmar destino"
                      aria-label="Confirmar destino"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveField(null);
                      setSearchQuery("");
                    }}
                    className="text-text-muted hover:text-ink p-0.5"
                    aria-label="Cerrar campo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-full flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveField("destination");
                      setSearchQuery(destinationLocation?.name || "");
                    }}
                    className={`flex-1 flex items-center justify-between text-left rounded-[16px] px-3 py-1.5 transition-colors group min-w-0 ${
                      destinationLocation
                        ? "bg-field/70 hover:bg-field"
                        : "bg-electric-blue/10 border border-electric-blue/30 hover:bg-electric-blue/15"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-text-muted font-medium block leading-none">
                        ¿A dónde vas?
                      </span>
                      <span
                        className={`text-xs font-bold truncate block mt-0.5 ${
                          destinationLocation ? "text-ink" : "text-electric-blue font-semibold"
                        }`}
                      >
                        {destinationLocation?.name || "Elegí tu destino"}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-text-muted shrink-0 group-hover:text-ink">
                      {destinationLocation ? "Cambiar" : "Escribir"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartMapPick?.("destination")}
                    title="Fijar destino en el mapa"
                    aria-label="Elegir destino en el mapa"
                    className="px-2.5 py-2 rounded-[16px] bg-canvas-soft hover:bg-field border border-hairline text-text-muted hover:text-ink text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow-xs"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-electric-blue" />
                    <span className="hidden xs:inline">En mapa</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Botón Swap / Invertir Origen y Destino */}
          <button
            type="button"
            onClick={onSwapPoints}
            title="Invertir origen y destino"
            aria-label="Invertir origen y destino"
            className="w-8 h-8 rounded-full bg-canvas-soft hover:bg-field border border-hairline flex items-center justify-center text-ink shrink-0 active:scale-95 transition-all shadow-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sugerencias rápidas de destinos emblemáticos */}
        {!destinationLocation && !activeField && (
          <div className="mt-2.5 pt-2 border-t border-hairline-soft flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-medium text-text-muted shrink-0">
              Lugares:
            </span>
            {KNOWN_POIS.slice(0, 5).map((poi) => (
              <button
                key={poi.name}
                type="button"
                onClick={() => onSelectDestination(poi)}
                className="px-2.5 py-1 rounded-full bg-canvas-soft hover:bg-field border border-hairline text-[10px] font-semibold text-ink shrink-0 whitespace-nowrap active:scale-95 transition-all"
              >
                {poi.name.split("(")[0].trim()}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Desplegable de búsqueda de ubicaciones cuando un campo está activo */}
      {activeField && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-canvas border border-hairline rounded-[24px] p-2 max-h-64 overflow-y-auto no-scrollbar space-y-1 z-50 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.25)]">
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-text-muted border-b border-hairline-soft mb-1">
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              {activeField === "origin" ? "Elegir origen" : "Elegir destino"}
            </span>
            <button
              type="button"
              onClick={() => {
                const target = activeField;
                setActiveField(null);
                onStartMapPick?.(target);
              }}
              className="text-electric-blue font-bold hover:underline flex items-center gap-1"
            >
              <Crosshair className="w-3 h-3" />
              Fijar en mapa
            </button>
          </div>

          {/* Opción para usar exactamente el texto libre ingresado */}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => handleConfirmFreeText(searchQuery)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[18px] bg-electric-blue/10 hover:bg-electric-blue/15 text-left transition-colors active:scale-[0.99]"
            >
              <div className="w-7 h-7 rounded-full bg-electric-blue text-white flex items-center justify-center shrink-0">
                <Navigation className="w-3.5 h-3.5" />
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-bold text-electric-blue truncate leading-tight">
                  Usar &quot;{searchQuery.trim()}&quot;
                </p>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  Confirmar esta ubicación
                </p>
              </div>
            </button>
          )}

          {filteredLocations.map((loc, idx) => (
            <button
              key={`${loc.name}-${idx}`}
              type="button"
              onClick={() => handleSelect(loc)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[18px] hover:bg-canvas-soft text-left transition-colors active:scale-[0.99]"
            >
              <div className="w-7 h-7 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center shrink-0 text-text-muted">
                <Navigation className="w-3.5 h-3.5 text-ink" />
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-bold text-ink truncate leading-tight">
                  {loc.name}
                </p>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  {loc.address || "Punto de ubicación en AMBA"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
