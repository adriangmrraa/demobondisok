"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowRight, Footprints, Bus, ChevronRight, ChevronDown, Layers, X, Info } from "lucide-react";
import { TripOption, LocationPoint } from "@/types/trip-planner";
import { TripPlannerService } from "@/lib/services/trip-planner-service";
import { useDragCollapse } from "@/lib/hooks/use-drag-collapse";
import type { BoardingOptionRow } from "@/lib/services/trip-boarding-options";

interface ViajePanelProps {
  options: TripOption[];
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onClose: () => void;
  hasPointsSelected?: boolean;
  originLocation?: LocationPoint | null;
  destinationLocation?: LocationPoint | null;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string | null) => void;
  /** sdd/trip-options-upgrade 2.2: filas de abordaje (≤3) por parada de subida. */
  boardingOptions?: BoardingOptionRow[];
  selectedBoardingUnitKey?: string | null;
  onSelectBoardingOption?: (unitKey: string) => void;
  /** sdd/trip-options-upgrade display: etiquetas vivas (EstimacionLlegada). */
  liveHeroLabel?: string | null;
  liveFooterLabel?: string | null;
  /** sdd/trip-options-upgrade 2.3: espeja ViajeHeader:24 — reframe en expand+collapse. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** sdd/trip-options-upgrade 2.5: re-pick de destino sin perder el origen. */
  onRepickDestination?: () => void;
}

export default function ViajePanel({
  options,
  selectedOptionId,
  onSelectOption,
  onClose,
  hasPointsSelected = true,
  originLocation = null,
  destinationLocation = null,
  selectedStepId = null,
  onSelectStep,
  boardingOptions = [],
  selectedBoardingUnitKey = null,
  onSelectBoardingOption,
  liveHeroLabel = null,
  liveFooterLabel = null,
  onCollapsedChange,
  onRepickDestination,
}: ViajePanelProps) {
  // Diagnóstico de cobertura cuando no hay rutas: ¿qué lado falla?
  const coverageInfo = useMemo(() => {
    if (options.length > 0 || !hasPointsSelected) return null;
    const oCands = originLocation ? TripPlannerService.findCandidateStops(originLocation) : [];
    const dCands = destinationLocation ? TripPlannerService.findCandidateStops(destinationLocation) : [];
    return {
      originNearest: oCands[0] || null,
      originCount: oCands.length,
      destNearest: dCands[0] || null,
      destCount: dCands.length,
    };
  }, [options.length, hasPointsSelected, originLocation, destinationLocation]);
  const [activeTab, setActiveTab] = useState<"opciones" | "guia">("opciones");
  const { collapsed, toggle, handleProps } = useDragCollapse(false);

  // sdd/trip-options-upgrade 2.3: notifica expand Y collapse (mirror ViajeHeader).
  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  const selectedTrip = options.find((o) => o.id === selectedOptionId) || options[0] || null;

  // White-card labels (sdd/trip-sheet-ui-fix 1.3): arrival clock vs total
  // duration as two distinct fields. Presentation-only derivation from the
  // already-resolved duration — no routing/ETA recomputation. Clock is read
  // in an effect (render must stay pure per react-hooks/purity).
  const [arrivalLabel, setArrivalLabel] = useState<string | null>(null);
  useEffect(() => {
    // Deferred to rAF like the rest of the codebase (react-hooks/set-state-in-effect).
    const frame = window.requestAnimationFrame(() => {
      if (!selectedTrip) {
        setArrivalLabel(null);
        return;
      }
      const d = new Date(Date.now() + selectedTrip.totalDurationMinutes * 60000);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      setArrivalLabel(`Llegás ${hh}:${mm}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTrip]);

  // CASO: Sin rutas disponibles (explicación humana, sin tecnicismos de RAPTOR ni corredores)
  if (options.length === 0 && hasPointsSelected) {
    return (
      <aside
        aria-label="Panel de opciones de viaje"
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-24px)] max-w-[420px] bg-canvas dark:bg-canvas border border-hairline rounded-[28px] p-5 shadow-[0_16px_45px_-4px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_-4px_rgba(0,0,0,0.7)] flex flex-col items-center text-center pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <div className="w-10 h-10 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center mb-2 text-text-muted">
          <Info className="w-5 h-5 text-electric-blue" />
        </div>
        <p className="text-sm font-bold text-ink">No encontramos una combinación viable</p>
        {coverageInfo && (
          <div className="w-full mt-2 space-y-1 text-left">
            <p className="text-xs text-text-muted leading-relaxed">
              {coverageInfo.originCount === 0
                ? `⚠️ Origen sin cobertura: no hay paradas a menos de 2000m.`
                : `✓ Origen: ${coverageInfo.originCount} parada(s) cerca${coverageInfo.originNearest ? ` (más cercana: ${coverageInfo.originNearest.stop.nombre} a ${coverageInfo.originNearest.distanceMeters}m)` : ""}.`}
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              {coverageInfo.destCount === 0
                ? `⚠️ Destino sin cobertura: no hay paradas a menos de 2000m.`
                : `✓ Destino: ${coverageInfo.destCount} parada(s) cerca${coverageInfo.destNearest ? ` (más cercana: ${coverageInfo.destNearest.stop.nombre} a ${coverageInfo.destNearest.distanceMeters}m)` : ""}.`}
            </p>
            {coverageInfo.originCount > 0 && coverageInfo.destCount > 0 && (
              <p className="text-xs text-text-muted leading-relaxed">
                Ambas puntas tienen paradas, pero ninguna línea conecta esos puntos (ni directo ni con transbordo). Probá con puntos sobre los corredores 65 o 194.
              </p>
            )}
          </div>
        )}
        <div className="mt-3.5 flex items-center gap-2">
          {onRepickDestination && (
            <button
              type="button"
              onClick={onRepickDestination}
              className="px-4 py-1.5 rounded-full bg-ink text-canvas text-xs font-bold transition-colors active:scale-95"
            >
              Elegir otro destino
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-canvas-soft hover:bg-field border border-hairline text-xs font-bold text-ink transition-colors active:scale-95"
          >
            Cerrar búsqueda
          </button>
        </div>
      </aside>
    );
  }

  // CASO: Aún no se seleccionaron origen y destino
  if (options.length === 0) {
    return (
      <aside
        aria-label="Panel de opciones de viaje"
        className="fixed bottom-[84px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-24px)] max-w-[420px] bg-canvas dark:bg-canvas border border-hairline rounded-[28px] p-5 shadow-[0_16px_45px_-4px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_-4px_rgba(0,0,0,0.7)] flex flex-col items-center text-center pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <p className="text-sm font-bold text-ink">Elegí tu destino para calcular el viaje</p>
        <p className="text-xs text-text-muted mt-1">
          Podés escribir una dirección o tocar &quot;En mapa&quot; para fijar un punto directamente.
        </p>
      </aside>
    );
  }

  // Fixed-height sheet (sdd/trip-sheet-ui-fix 2.1): expanded height is fixed
  // and dvh-capped so the top edge never rises above the recenter controls
  // nor covers the bus marker. Collapsed stays a 76px strip.
  return (
    <aside
      aria-label="Panel de opciones de viaje"
      className="fixed bottom-[84px] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-24px)] max-w-[420px] bg-canvas dark:bg-canvas border border-hairline rounded-[28px] shadow-[0_16px_45px_-4px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_-4px_rgba(0,0,0,0.7)] flex flex-col pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200 overflow-hidden transition-[max-height] duration-300"
      style={{ height: collapsed ? 76 : "min(46dvh, 430px)", maxHeight: collapsed ? "76px" : "min(46dvh, 430px)" }}
    >
      {/* Grip de arrastre */}
      <div className="pt-1.5 pb-0.5 flex justify-center shrink-0" aria-hidden="true">
        <div className="w-9 h-1 rounded-full bg-hairline" />
      </div>
      {/* Header: pinned selected-trip summary (outside the scroll container,
          opaque bg so scrolled content slides under it) + view toggle */}
      <div
        className="px-4 pt-2 pb-2 flex items-center justify-between shrink-0 select-none bg-canvas dark:bg-canvas relative z-10"
        {...handleProps}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          toggle();
        }}
        title={collapsed ? "Expandir panel" : "Contraer panel"}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          {selectedTrip && (
            <span aria-live="polite" className="text-lg font-black text-ink tracking-tight tabular-nums">
              {liveHeroLabel ?? `${selectedTrip.totalDurationMinutes} min total`}
            </span>
          )}
          <span className="text-xs text-text-muted truncate">
            {options.length} alternativa{options.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("opciones")}
            className={`px-2 py-1 text-xs font-semibold transition-colors ${
              activeTab === "opciones" ? "text-ink underline underline-offset-4 decoration-2" : "text-text-muted hover:text-ink"
            }`}
          >
            Opciones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guia")}
            className={`px-2 py-1 text-xs font-semibold transition-colors ${
              activeTab === "guia" ? "text-ink underline underline-offset-4 decoration-2" : "text-text-muted hover:text-ink"
            }`}
          >
            Pasos
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="p-1.5 text-text-muted hover:text-ink transition-colors"
            title={collapsed ? "Expandir" : "Contraer"}
            aria-label={collapsed ? "Expandir panel" : "Contraer panel"}
            aria-expanded={!collapsed}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-ink transition-colors"
            title="Cerrar panel de opciones"
            aria-label="Cerrar panel de opciones"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenido según la pestaña activa (oculto al contraer) */}
      {!collapsed && (
      <div className="p-3 overflow-y-auto overscroll-contain no-scrollbar space-y-2.5 flex-1 min-h-0">
        {/* Opciones/Pasos scroll internally (2.2): min-h-0 lets the flex child
            shrink so overflow-y-auto engages; overscroll-contain keeps sheet
            scroll from chaining to the map. */}
        {activeTab === "opciones" ? (
          <div className="space-y-2">
            {/* sdd/trip-options-upgrade 2.2: filas de abordaje (≤3) — unidad×ETA×línea.
                Tap → mapa (correct bus) en un render. Aditivo sobre tripOptions. */}
            {boardingOptions.length > 0 && (
              <div className="space-y-1.5" aria-label="Próximos colectivos en tu parada">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  En tu parada · {boardingOptions.length} opcion{boardingOptions.length > 1 ? "es" : ""}
                </p>
                {boardingOptions.slice(0, 3).map((row) => {
                  const isRowSelected = row.unitKey === selectedBoardingUnitKey;
                  return (
                    <button
                      key={row.unitKey}
                      type="button"
                      onClick={() => onSelectBoardingOption?.(row.unitKey)}
                      aria-label={`Tomar línea ${row.lineaNumero}, coche ${row.interno}, ${row.displayLabel}`}
                      className={`w-full text-left px-3 py-2 rounded-[16px] transition-colors active:scale-[0.99] flex items-center justify-between gap-2 ${
                        isRowSelected
                          ? "bg-canvas-soft ring-1 ring-ink/15"
                          : "hover:bg-canvas-soft/60"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-black shadow-2xs shrink-0"
                          style={{ backgroundColor: row.colorHex, color: "#FFFFFF" }}
                        >
                          {row.lineaNumero}
                        </span>
                        <span className="text-xs font-bold text-ink truncate">
                          Coche {row.interno}
                          <span className="ml-1.5 text-[10px] font-semibold text-text-muted">
                            {row.kind === "same-nearest" ? "· más próximo" : row.kind === "same-late" ? "· siguiente" : "· otra línea"}
                          </span>
                        </span>
                      </span>
                      <span aria-live="polite" className="text-xs font-bold text-[#16a34a] shrink-0 tabular-nums">
                        {row.displayLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {options.map((opt) => {
              const isSelected = opt.id === (selectedTrip?.id || selectedOptionId);

              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectOption(opt.id)}
                  className={`px-3 py-2.5 rounded-[16px] transition-colors cursor-pointer select-none active:scale-[0.99] ${
                    isSelected
                      ? "bg-canvas-soft ring-1 ring-ink/15"
                      : "hover:bg-canvas-soft/60 text-text-muted"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-ink tracking-tight tabular-nums">
                        ~{opt.totalDurationMinutes} min
                      </span>
                      <span className="text-xs text-text-muted">
                        · {opt.transfersCount === 0 ? "directo" : `${opt.transfersCount} combinación`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {opt.linesInvolved
                        .filter((l, idx, arr) => idx === 0 || l.id !== arr[idx - 1].id)
                        .map((l, idx) => (
                        <div key={`${l.id}-${idx}`} className="flex items-center gap-1">
                          {idx > 0 && (
                            <ArrowRight className="w-2.5 h-2.5 text-text-muted" />
                          )}
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-black shadow-2xs"
                            style={{
                              backgroundColor: l.color,
                              color: l.textColor || "#FFFFFF",
                            }}
                          >
                            {l.numero}
                          </span>
                        </div>
                      ))}
                      {opt.linesInvolved.length === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-canvas-soft border border-hairline text-ink">
                          A pie
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-muted font-medium truncate">
                    {opt.title}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted">
                      {opt.walkDistanceMeters} m a pie
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOption(opt.id);
                        setActiveTab("guia");
                      }}
                      className="text-xs font-semibold text-text-muted hover:text-ink flex items-center gap-0.5"
                    >
                      Ver pasos
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Pestaña: Guía paso a paso (tapeable → enfoca el mapa) */
          <div className="space-y-1 py-1">
            {selectedTrip?.steps.map((step, idx) => {
              const isStepSelected = step.id === selectedStepId;
              const tappable = step.legIndex !== undefined && onSelectStep;
              return (
              <div
                key={step.id}
                role={tappable ? "button" : undefined}
                tabIndex={tappable ? 0 : undefined}
                aria-label={tappable ? `Ver paso ${idx + 1} en el mapa` : undefined}
                onClick={tappable ? () => onSelectStep(isStepSelected ? null : step.id) : undefined}
                onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectStep(isStepSelected ? null : step.id); } } : undefined}
                className={`flex items-start gap-3 relative rounded-[16px] px-2 py-2 -mx-2 transition-colors ${
                  tappable ? "cursor-pointer active:scale-[0.99]" : ""
                } ${
                  isStepSelected ? "bg-electric-blue/10 ring-1 ring-electric-blue/30" : tappable ? "hover:bg-canvas-soft" : ""
                }`}
              >
                {/* Línea conectora entre pasos */}
                {idx < selectedTrip.steps.length - 1 && (
                  <div className="absolute left-[22px] top-9 bottom-0 w-0.5 bg-hairline -z-0" />
                )}

                {/* Ícono de tipo de paso + número (lenguaje único, neutro) */}
                <div className="flex flex-col items-center shrink-0 z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border border-hairline bg-canvas-soft text-ink ${
                      isStepSelected ? "ring-2 ring-electric-blue ring-offset-1" : ""
                    }`}
                  >
                    {step.type === "walk" && <Footprints className="w-3.5 h-3.5" />}
                    {step.type === "transfer" && <Layers className="w-3.5 h-3.5" />}
                    {step.type === "ride" && <Bus className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[9px] font-bold text-text-faint mt-0.5">{idx + 1}</span>
                </div>

                {/* Detalle del paso */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-ink truncate leading-tight">
                      {step.description}
                    </p>
                    <span className="text-[10px] font-semibold text-text-muted shrink-0">
                      ~{step.durationMinutes} min
                    </span>
                  </div>

                  {step.type === "ride" && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: step.lineaColor || "#1D4ED8" }}
                      >
                        Línea {step.lineaNumero}
                      </span>
                      {step.ramalCodigo && (
                        <span className="text-[10px] text-text-muted font-medium truncate">
                          Ramal {step.ramalCodigo}{step.ramalNombre ? ` · ${step.ramalNombre}` : ""}
                        </span>
                      )}
                      {step.stopCount !== undefined && step.stopCount > 0 && (
                        <span className="text-[10px] text-text-muted font-medium">
                          · {step.stopCount} parada{step.stopCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}

                  {step.type === "walk" && step.distanceMeters !== undefined && step.distanceMeters > 0 && (
                    <p className="text-[10px] text-text-muted font-medium mt-0.5">
                      {step.distanceMeters}m a pie
                    </p>
                  )}

                  {step.type === "transfer" && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                      Transbordo entre líneas
                      {step.distanceMeters !== undefined && step.distanceMeters > 15 ? ` · ${step.distanceMeters}m a pie` : ""}
                    </p>
                  )}
                </div>
              </div>
              );
            })}

            <div className="pt-2 flex items-center justify-between">
              <span aria-live="polite" className="text-xs text-text-muted">
                {liveFooterLabel ?? arrivalLabel ?? `Llegada ~${selectedTrip.totalDurationMinutes} min`}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("opciones")}
                className="text-xs text-text-muted hover:text-ink"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </aside>
  );
}
