"use client";

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

interface LineSchematicStop {
  id: string;
  nombre: string;
  tipo?: string;
}

interface LineSchematicProps {
  origin: string;
  eta?: string;
  color: string;
  stops: LineSchematicStop[];
  highlightStopId?: string;
  onOpenStopPicker: () => void;
  className?: string;
}

const STOP_W_CLASSES = "w-32 sm:w-32";
const STOP_W_PX = 128;
const STOP_W_HALF_PX = STOP_W_PX / 2;
const DOT_SIZE_HEAD = 14;

/** A compact, horizontally pannable representation of one selected route. */
export function LineSchematic({
  origin,
  eta,
  color,
  stops,
  highlightStopId,
  onOpenStopPicker,
  className,
}: LineSchematicProps) {
  const reactId = useId();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const previousHighlightIdRef = useRef<string | undefined>(undefined);

  const firstStopName = stops[0]?.nombre ?? "";
  const lastStopName = stops[stops.length - 1]?.nombre ?? "";
  const activeIndex = useMemo(
    () => stops.findIndex((stop) => stop.id === highlightStopId),
    [stops, highlightStopId],
  );

  const centerActiveStop = (behavior: ScrollBehavior) => {
    const item = activeItemRef.current;
    const container = scrollerRef.current;
    if (!item || !container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scrollLeft =
      item.offsetLeft - container.clientWidth / 2 + item.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, scrollLeft),
      behavior: behavior === "smooth" && !reducedMotion ? "smooth" : "auto",
    });
  };

  // The first rendered stop is centered before paint. Later state changes animate once.
  useLayoutEffect(() => {
    if (!highlightStopId) return;
    const behavior: ScrollBehavior = previousHighlightIdRef.current
      ? "smooth"
      : "auto";
    centerActiveStop(behavior);
    previousHighlightIdRef.current = highlightStopId;
  }, [highlightStopId]);

  return (
    <div
      className={cn(
        "relative h-full w-full select-none overflow-hidden",
        className,
      )}
      role="group"
      aria-label="Diagrama lineal de la línea. Deslizá horizontalmente para ver todas las paradas."
      data-testid="line-schematic"
    >
      <div className="pointer-events-none absolute left-3 right-3 top-2 z-20 flex items-start justify-between gap-2 text-xs">
        <p className="truncate font-bold text-ink">{origin}</p>
        {eta && (
          <p className="shrink-0 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted backdrop-blur-md">
            {eta}
          </p>
        )}
      </div>

      <div
        ref={scrollerRef}
        data-testid="schematic-scroller"
        className="absolute inset-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain [touch-action:pan-x] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
        style={{ scrollPaddingInline: `${STOP_W_HALF_PX}px` }}
      >
        <div
          className="relative h-full w-max min-w-full"
          style={{ paddingInline: `calc(50% - ${STOP_W_HALF_PX}px)` }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{ height: 8, background: color, opacity: 0.2 }}
          />
          <div
            aria-hidden="true"
            data-testid="schematic-track"
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{ height: 2.5, background: color }}
          />
          <ul
            className="z-10 flex h-full flex-row items-stretch justify-start"
            aria-label={`Paradas de la línea: ${stops.map((stop) => stop.nombre).join(", ")}`}
          >
            {stops.map((stop, index) => {
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const isHead = isFirst || isLast || stop.tipo === "CABECERA";
              const isHighlight = highlightStopId === stop.id;
              const dotSize = isHead ? DOT_SIZE_HEAD : 12;

              return (
                <li
                  key={`${stop.id}-${reactId}`}
                  ref={isHighlight ? activeItemRef : null}
                  data-stop-id={stop.id}
                  className={cn(
                    "relative h-full shrink-0 snap-center px-1 transition-transform duration-300 ease-out",
                    STOP_W_CLASSES,
                    isHighlight && "scale-105",
                  )}
                  style={{ minWidth: STOP_W_PX }}
                >
                  <button
                    type="button"
                    onClick={onOpenStopPicker}
                    aria-current={isHighlight ? "location" : undefined}
                    className="relative block h-full w-full cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-blue"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ width: dotSize + 8, height: dotSize + 8 }}
                    >
                      {isHighlight && (
                        <span
                          className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse"
                          style={{
                            background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
                          }}
                        />
                      )}
                      <span
                        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          width: dotSize,
                          height: dotSize,
                          backgroundColor: isHead ? color : "white",
                          borderColor: color,
                          borderStyle: "solid",
                          borderWidth: isHead ? 0 : isHighlight ? 3 : 2,
                          boxShadow: isHighlight
                            ? `0 0 0 2px white, 0 0 0 4px ${color}55`
                            : isHead
                              ? `0 0 0 2px ${color}`
                              : undefined,
                        }}
                      >
                        {isHead && (
                          <span className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                        )}
                      </span>
                    </span>

                    <span className="absolute inset-x-0 top-1/2 mt-1.5 flex flex-col items-center text-center">
                      <span
                        title={stop.nombre}
                        className={cn(
                          "block w-full truncate px-1 text-[10px] leading-tight sm:text-[11px]",
                          isHighlight
                            ? "font-bold text-white"
                            : isHead
                              ? "font-bold text-slate-300"
                              : "font-medium text-slate-400",
                        )}
                      >
                        {stop.nombre}
                      </span>
                      {stop.tipo && stops.length <= 14 && (
                        <span
                          className={cn(
                            "mt-0.5 block w-full truncate text-[9px] font-semibold uppercase tracking-[0.08em]",
                            isHighlight ? "text-slate-300" : "text-slate-500",
                          )}
                        >
                          {stop.tipo}
                        </span>
                      )}
                      {(isFirst || isLast) && (
                        <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-text-muted">
                          {isFirst ? "◤ Inicio" : "Fin ◢"}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
        <span className="truncate" title={firstStopName}>
          ◤ {truncate(firstStopName, 16)}
        </span>
        <span className="truncate text-right" title={lastStopName}>
          {truncate(lastStopName, 16)} ◢
        </span>
      </div>
      {activeIndex >= 0 && stops.length > 1 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-hairline/40 bg-canvas/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-text-muted backdrop-blur-md"
        >
          {activeIndex + 1} / {stops.length}
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}
