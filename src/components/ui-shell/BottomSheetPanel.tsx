"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "motion/react";
import {
  Clock,
  MapPin,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Users,
  BusFront,
  CheckCircle2,
} from "lucide-react";
import { AlertaServicio, EstimacionLlegada, Linea, Parada } from "@/types/transport";
import type { VehiclePosition } from "@/lib/data-service";
import type { CameraMode } from "@/lib/map/camera-controller";
import type { StopAlongRoute } from "@/lib/map/route-progress";
import { RouteTimeline } from "@/components/map/RouteTimeline";
import { Eye } from "lucide-react";
import { computeLineStopStatuses } from "@/lib/services/stop-schedule-service";
import { StopSequenceItem } from "@/components/ui-shell/StopSequenceItem";
import { InlineBusIndicator } from "@/components/ui-shell/InlineBusIndicator";
import { StopDetailCard } from "@/components/ui-shell/StopDetailCard";
import { TransportService } from "@/lib/services/transport-service";

export type SheetState = "collapsed" | "peek" | "expanded";

interface BottomSheetPanelProps {
  selectedLinea: Linea | null;
  selectedRamalId?: string | null;
  selectedParada: Parada | null;
  paradas: Parada[];
  llegadas: EstimacionLlegada[];
  alertas: AlertaServicio[];
  totalVehiculosActivos?: number;
  onSelectParada: (parada: Parada) => void;
  onClearSelection: () => void;
  selectedVehiculo?: VehiclePosition | null;
  cameraMode?: CameraMode;
  onToggle3D?: () => void;
  timelineStops?: StopAlongRoute[];
  busProgress?: number;
  busAlongM?: number;
  positions?: VehiclePosition[];
  userLocation?: { lat: number; lng: number } | null;
}

/**
 * Componente modular BottomSheetPanel (Fase 3 & 4).
 * Panel táctil deslizable inferior con 3 estados conceptuales (collapsed, peek, expanded)
 * optimizado para ergonomía móvil, safe-areas (home bar) y touch targets de 44px+.
 * Integra telemetría en tiempo real por parada, transbordos, micro-acordeón y colectivo en tránsito.
 */
export default function BottomSheetPanel({
  selectedLinea,
  selectedRamalId,
  selectedParada,
  paradas,
  llegadas,
  alertas,
  totalVehiculosActivos = 0,
  onSelectParada,
  onClearSelection,
  selectedVehiculo = null,
  cameraMode = "overview",
  onToggle3D,
  timelineStops = [],
  busProgress = 0,
  busAlongM = 0,
  positions = [],
  userLocation = null,
}: BottomSheetPanelProps) {
  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const [activeTab, setActiveTab] = useState<"llegadas" | "paradas" | "alertas">("llegadas");
  const [selectedDetailParada, setSelectedDetailParada] = useState<Parada | null>(null);

  // Al seleccionar una parada (ej: click en el mapa), abrir el sheet en la pestaña 'paradas' con vista de secuencia
  useEffect(() => {
    if (selectedParada) {
      setActiveTab("paradas");
      setSheetState((current) => (current === "collapsed" ? "peek" : current));
      setSelectedDetailParada(null); // No mostrar la ficha embebida hasta que el usuario toque la parada en la secuencia
    }
  }, [selectedParada]);

  const detailLlegada = useMemo(() => {
    if (!selectedDetailParada) return null;
    const items = TransportService.getLlegadasPorParada(selectedDetailParada.id, positions);
    return items[0] || null;
  }, [selectedDetailParada, positions]);

  const selectedRamal = useMemo(() => {
    if (!selectedLinea || !selectedRamalId) return null;
    return selectedLinea.ramalesDetalle?.find((r) => r.id === selectedRamalId) || null;
  }, [selectedLinea, selectedRamalId]);

  const paradasFiltradas = useMemo(() => {
    if (!selectedLinea) return paradas;
    if (selectedRamal) {
      const ramalStopIds = new Set(
        selectedRamal.recorridos?.flatMap((rec) => rec.paradas) || []
      );
      return paradas.filter((p) => ramalStopIds.has(p.id));
    }
    return paradas.filter((p) => p.lineasIds.includes(selectedLinea.id));
  }, [selectedLinea, selectedRamal, paradas]);

  const alertasFiltradas = selectedLinea
    ? alertas.filter((a) => a.lineaId === selectedLinea.id)
    : alertas;

  // Cálculo en tiempo real de estados de paradas, ETAs y unidades en tránsito (Fase 3)
  const { statuses: stopStatuses, busesInTransit } = useMemo(() => {
    if (!selectedLinea || paradasFiltradas.length === 0) {
      return { statuses: [], busesInTransit: [] };
    }
    return computeLineStopStatuses(
      selectedLinea.id,
      paradasFiltradas,
      positions,
      userLocation,
    );
  }, [selectedLinea, paradasFiltradas, positions, userLocation]);

  // Alturas optimizadas con dvh y safe area
  const heightStyles: Record<SheetState, string> = {
    collapsed: "h-[calc(76px+env(safe-area-inset-bottom,0px))]",
    peek: "h-[calc(340px+env(safe-area-inset-bottom,0px))]",
    expanded: "h-[82dvh]",
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 35;
    if (info.offset.y < -threshold) {
      if (sheetState === "collapsed") setSheetState("peek");
      else if (sheetState === "peek") setSheetState("expanded");
    } else if (info.offset.y > threshold) {
      if (sheetState === "expanded") setSheetState("peek");
      else if (sheetState === "peek") setSheetState("collapsed");
    }
  };

  const toggleNextState = () => {
    if (sheetState === "collapsed") setSheetState("peek");
    else if (sheetState === "peek") setSheetState("expanded");
    else setSheetState("peek");
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.12}
      onDragEnd={handleDragEnd}
      className={`fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto bg-canvas border-t border-hairline rounded-t-[24px] transition-all duration-300 pointer-events-auto flex flex-col pb-[max(16px,env(safe-area-inset-bottom))] ${heightStyles[sheetState]}`}
    >
      {/* 1. Handle de agarre superior & Barra de Estado Resumen */}
      <div
        onClick={toggleNextState}
        className="pt-3 pb-2 px-5 flex flex-col items-center cursor-pointer select-none shrink-0 min-h-[48px]"
      >
        <div className="w-10 h-1 rounded-full bg-hairline mb-2.5" />

        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            {selectedLinea ? (
              <div className="flex items-center gap-2 truncate">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
                  style={{ backgroundColor: selectedLinea.colorHex, color: selectedLinea.textColorHex }}
                >
                  Línea {selectedLinea.numero}
                </span>
                <span className="text-xs font-semibold text-ink truncate">
                  {selectedRamal
                    ? `Ramal ${selectedRamal.codigo} · ${selectedRamal.nombre}`
                    : selectedLinea.nombre}
                </span>
              </div>
            ) : selectedParada ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-ink truncate">
                <div className="w-6 h-6 rounded-full bg-canvas-soft text-text-muted flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{selectedParada.nombre}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <BusFront className="w-4 h-4 text-text-muted" />
                <span>Monitoreo La Nueva Metropol</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-text-muted shrink-0 ml-2">
            <span className="text-xs capitalize hidden sm:inline">
              {sheetState}
            </span>
            {sheetState === "expanded" ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>

      {/* 2. Tabs de Navegación — Segmented Control Stadium Pill (DESIGN.MD) */}
      {sheetState !== "collapsed" && (
        <div className="px-4 py-1.5 border-b border-hairline-soft shrink-0">
          <div className="bg-canvas-soft p-1 rounded-full flex items-center justify-between gap-1">
            <button
              onClick={() => setActiveTab("llegadas")}
              className={`flex-1 min-h-[36px] px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === "llegadas"
                  ? "bg-canvas text-ink border border-hairline-soft"
                  : "text-text-muted hover:text-ink"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Llegadas ({llegadas.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("paradas")}
              className={`flex-1 min-h-[36px] px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === "paradas"
                  ? "bg-canvas text-ink border border-hairline-soft"
                  : "text-text-muted hover:text-ink"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Paradas ({paradasFiltradas.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("alertas")}
              className={`flex-1 min-h-[36px] px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === "alertas"
                  ? "bg-canvas text-ink border border-hairline-soft"
                  : "text-text-muted hover:text-ink"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Alertas ({alertasFiltradas.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Contenido Desplazable del Panel */}
      {sheetState !== "collapsed" && (
        <div className="flex-1 p-4 overflow-y-auto no-scrollbar space-y-3 overscroll-contain">
          {/* Tarjeta de Unidad en Vivo Seleccionada */}
          {selectedVehiculo && (
            <div className="bg-canvas-soft border border-hairline-soft rounded-[24px] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="px-3 py-1 rounded-full text-white font-bold text-xs shrink-0"
                    style={{ backgroundColor: selectedLinea?.colorHex || "#1D4ED8" }}
                  >
                    {selectedLinea?.numero || selectedVehiculo.lineId.replace("line-", "")}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-ink">
                      Unidad {selectedVehiculo.unitId}
                    </h4>
                    <p className="text-[11px] text-text-muted">
                      {selectedLinea?.nombre || "Unidad en Circulación"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold text-ink tabular-nums">
                    {Math.round(selectedVehiculo.speed)} km/h
                  </span>
                  <span className="text-[11px] font-medium text-text-muted">
                    GPS en vivo
                  </span>
                </div>
              </div>

              {onToggle3D && (
                <button
                  onClick={onToggle3D}
                  className={`w-full min-h-[40px] px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2 touch-manipulation ${
                    cameraMode === "navigation-vehicle"
                      ? "bg-primary text-primary-foreground"
                      : "bg-canvas text-ink border border-hairline hover:bg-canvas-soft"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>
                    {cameraMode === "navigation-vehicle"
                      ? "Cámara 3D activa (Tocar para vista 2D)"
                      : "Seguir colectivo en 3D (Pitch 52°)"}
                  </span>
                </button>
              )}

              {timelineStops.length > 0 && (
                <div className="pt-3 border-t border-hairline-soft">
                  <p className="text-xs font-semibold text-text-muted mb-2">
                    Cronograma de paradas
                  </p>
                  <RouteTimeline
                    color={selectedLinea?.colorHex || "#059669"}
                    onColor="#FFFFFF"
                    stops={timelineStops}
                    busProgress={busProgress}
                    busAlongM={busAlongM}
                    speedKmh={selectedVehiculo.speed || 15}
                    shortName={selectedLinea?.numero || selectedVehiculo.lineId.replace("line-", "")}
                  />
                </div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* TAB 1: FICHA TÉCNICA & LLEGADAS (ETA) */}
            {activeTab === "llegadas" && (
              <motion.div
                key="tab-llegadas-content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                {/* Ficha técnica compacta */}
                {selectedLinea && (
                  <div className="bg-canvas-soft border border-hairline-soft rounded-[16px] p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        {selectedLinea.empresa}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-canvas border border-hairline-soft text-text-muted font-medium text-[11px]">
                        Frecuencia: {selectedLinea.frecuenciaPicoMin} min
                      </span>
                    </div>
                    {selectedLinea.mensajeEstado && (
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {selectedLinea.mensajeEstado}
                      </p>
                    )}
                  </div>
                )}

                {/* Próximos colectivos (ETAs) */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-muted px-1">
                    Próximos arribos estimados
                  </p>

                  {llegadas.length === 0 ? (
                    <div className="text-center py-6 text-text-muted text-xs">
                      No hay arribos programados en esta parada en este momento.
                    </div>
                  ) : (
                    llegadas.map((llegada, idx) => (
                      <div
                        key={`${llegada.lineaId}-${llegada.interno}-${idx}`}
                        className="bg-canvas border border-hairline-soft rounded-[16px] p-3 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                            style={{ backgroundColor: llegada.colorHex }}
                          >
                            {llegada.lineaNumero}
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-ink">
                              {llegada.ramal}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                              <span>Unidad {llegada.interno}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {llegada.ocupacion}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-1">
                            {llegada.displayStatus === "en-parada" || llegada.minutos <= 0 ? (
                              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
                                En parada
                              </span>
                            ) : llegada.displayStatus === "arribando" || llegada.minutos <= 2 ? (
                              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
                                Arribando
                              </span>
                            ) : (
                              <>
                                <span className="text-lg font-bold text-ink tabular-nums">
                                  {llegada.minutos}
                                </span>
                                <span className="text-xs font-medium text-text-muted">min</span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted font-normal">
                            {llegada.distanciaMetros <= 15 ? "En andén" : `a ${llegada.distanciaMetros}m`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 2: LISTA DE PARADAS & RECORRIDO (Touch target de 48px por parada) */}
            {activeTab === "paradas" && (
              <motion.div
                key="tab-paradas-content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Secuencia de paradas ({paradasFiltradas.length})
                  </p>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Tocar para ver información detallada
                  </span>
                </div>

                {/* Ficha embebida de detalle de parada (dentro del modal, sin ventana emergente) */}
                {selectedDetailParada && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -6 }}
                    className="mb-3"
                  >
                    <StopDetailCard
                      parada={selectedDetailParada}
                      linea={selectedLinea}
                      selectedRamalId={selectedRamalId}
                      proximoArribo={detailLlegada}
                      onClose={() => setSelectedDetailParada(null)}
                    />
                  </motion.div>
                )}

                {stopStatuses.length > 0 ? (
                  <div className="space-y-0.5">
                    {stopStatuses.map((status, idx) => {
                      const isSelected = selectedParada?.id === status.stop.id;
                      const nextStatus = stopStatuses[idx + 1];
                      const busesBetween = nextStatus
                        ? busesInTransit.filter(
                            (b) =>
                              b.fromStop.id === status.stop.id &&
                              b.toStop.id === nextStatus.stop.id
                          )
                        : [];

                      return (
                        <div key={status.stop.id}>
                          <StopSequenceItem
                            status={status}
                            isSelected={isSelected}
                            onSelect={() => {
                              onSelectParada(status.stop);
                              setSelectedDetailParada(status.stop);
                            }}
                            isFirst={idx === 0}
                            isLast={idx === stopStatuses.length - 1}
                          />

                          {busesBetween.map((bus) => (
                            <InlineBusIndicator
                              key={`bus-transit-${bus.unitId}-${idx}`}
                              bus={bus}
                              color={selectedLinea?.colorHex || "#1D4ED8"}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  paradasFiltradas.map((parada) => {
                    const isSelected = selectedParada?.id === parada.id;
                    return (
                      <div
                        key={parada.id}
                        onClick={() => {
                          onSelectParada(parada);
                          setSelectedDetailParada(parada);
                        }}
                        className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-full cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-canvas-soft border border-hairline"
                            : "hover:bg-canvas-soft"
                        }`}
                      >
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-3 h-3 rounded-full border-2 ${
                              isSelected
                                ? "bg-ink border-canvas ring-2 ring-ink"
                                : "bg-text-faint border-canvas"
                            }`}
                          />
                        </div>

                        <div className="flex-1 truncate">
                          <p className="text-xs font-semibold text-ink truncate">
                            {parada.nombre}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">{parada.direccion}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {parada.lineasIds.slice(0, 3).map((lId) => (
                            <span
                              key={lId}
                              className="px-2 py-0.5 rounded-full bg-canvas border border-hairline-soft text-[10px] font-semibold text-text-muted"
                            >
                              {lId.replace("linea-", "").replace("line-", "")}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* TAB 3: ALERTAS DE SERVICIO */}
            {activeTab === "alertas" && (
              <motion.div
                key="tab-alertas-content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-2.5"
              >
                <p className="text-xs font-semibold text-text-muted px-1">
                  Novedades operativas del servicio
                </p>

                {alertasFiltradas.length === 0 ? (
                  <div className="text-center py-6 text-text-muted text-xs flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-text-muted" />
                    <span>Línea 65 operando con normalidad.</span>
                  </div>
                ) : (
                  alertasFiltradas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="p-3.5 rounded-[16px] border border-hairline-soft bg-canvas-soft space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">
                            Línea {alerta.lineaNumero}
                          </span>
                          <span className="text-xs font-semibold text-ink">
                            {alerta.titulo}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted font-normal">
                          {alerta.fechaHora}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {alerta.descripcion}
                      </p>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
