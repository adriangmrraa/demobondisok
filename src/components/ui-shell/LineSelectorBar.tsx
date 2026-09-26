"use client";

import React, { useState } from "react";
import { Layers } from "lucide-react";
import { Linea, RamalDefinition } from "@/types/transport";

interface LineSelectorBarProps {
  lineas: Linea[];
  selectedLineaId: string | null;
  selectedRamalId?: string | null;
  onSelectLinea: (lineaId: string | null) => void;
  onSelectRamal?: (ramalId: string | null) => void;
  hasTopPill?: boolean;
}

export function getRamalLetter(ramal: RamalDefinition): string {
  if (ramal.codigo.toLowerCase().includes("troncal")) return "T";
  const match = ramal.codigo.match(/Ramal\s+([A-Z0-9]+)/i);
  if (match && match[1]) return match[1].toUpperCase();
  return ramal.codigo.trim().charAt(0).toUpperCase() || "R";
}

export function getRamalDisplayName(ramal: RamalDefinition): string {
  return ramal.nombre;
}

/**
 * Componente modular LineSelectorBar (Rail Vertical a la Izquierda).
 * Disposición vertical con jerarquía visual de 3 niveles:
 * 1. Botón superior izquierdo (Listado general): despliega SOLO las líneas. No afecta el mapa.
 * 2. Badges de Línea (65, 194): al tocar una línea se despliegan ÚNICAMENTE sus ramales.
 * 3. Badges de Ramal (T, A, B, etc.): al tocar un ramal, el mapa muestra solo ese recorrido.
 */
export default function LineSelectorBar({
  lineas,
  selectedLineaId,
  selectedRamalId,
  onSelectLinea,
  onSelectRamal,
  hasTopPill = false,
}: LineSelectorBarProps) {
  // 1. Estado predeterminado: por defecto NO desplegado (únicamente botón superior visible)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Determinar si hay algo activo (menú abierto o alguna línea/ramal visible en el mapa)
  const hasActiveContent = Boolean(isMenuOpen || selectedLineaId || selectedRamalId);

  const handleMainButtonClick = () => {
    if (hasActiveContent) {
      // Si el menú está abierto o hay algo visible en el mapa: cerrar y limpiar absolutamente todo
      setIsMenuOpen(false);
      onSelectLinea(null);
      onSelectRamal?.(null);
    } else {
      // Si el mapa y el menú estaban limpios: desplegar la lista de líneas disponibles (sin ramales)
      setIsMenuOpen(true);
    }
  };

  if (lineas.length <= 1) return null;

  return (
    <aside
      aria-label="Selector jerárquico de líneas y ramales"
      className={`absolute left-2 z-25 flex flex-col items-start gap-2.5 pointer-events-auto max-h-[calc(100dvh-200px)] overflow-y-auto no-scrollbar p-2 transition-all duration-300 ease-out ${
        hasTopPill
          ? "top-[calc(max(14px,env(safe-area-inset-top))+126px)]"
          : "top-[calc(max(14px,env(safe-area-inset-top))+62px)]"
      }`}
    >
      {/* 2. Botón superior izquierdo (Interruptor Maestro de Doble Vía):
          - Desde estado limpio: despliega ÚNICAMENTE la lista con las líneas disponibles.
          - Si el menú está abierto o hay elementos visibles: cierra el menú y limpia/oculta
            absolutamente todas las líneas, ramales y colectivos del mapa. */}
      <button
        type="button"
        onClick={handleMainButtonClick}
        title={hasActiveContent ? "Ocultar menú y limpiar mapa" : "Ver lista de líneas disponibles"}
        aria-label={hasActiveContent ? "Ocultar menú y limpiar mapa" : "Ver lista de líneas disponibles"}
        className={`w-10 h-10 rounded-full text-xs font-bold transition-all shrink-0 flex items-center justify-center touch-manipulation shadow-md ${
          hasActiveContent
            ? "bg-ink text-canvas ring-2 ring-ink ring-offset-2 ring-offset-canvas scale-105"
            : "bg-canvas/90 text-text-muted border border-hairline hover:bg-canvas-soft hover:text-ink"
        }`}
      >
        <Layers className="w-4 h-4" />
      </button>

      {/* Árbol Jerárquico por Línea: visible SOLO si isMenuOpen es true */}
      {isMenuOpen && (
        <div className="flex flex-col items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {lineas.map((linea) => {
            const isLineSelected = selectedLineaId === linea.id;
            const ramales = linea.ramalesDetalle || [];

            return (
              <div key={linea.id} className="flex flex-col items-start">
                {/* 3. Badge de Línea:
                    - Al hacer clic, se selecciona la línea y se despliegan ÚNICAMENTE sus ramales. */}
                <button
                  type="button"
                  onClick={() => {
                    if (isLineSelected && !selectedRamalId) {
                      onSelectLinea(null);
                      onSelectRamal?.(null);
                    } else {
                      onSelectLinea(linea.id);
                      onSelectRamal?.(null);
                    }
                  }}
                  title={`Línea ${linea.numero} — ${linea.nombre}`}
                  aria-label={`Línea ${linea.numero}`}
                  className={`w-10 h-10 rounded-full font-black text-sm transition-all shrink-0 flex items-center justify-center touch-manipulation shadow-md ${
                    isLineSelected
                      ? "ring-2 ring-ink ring-offset-2 ring-offset-canvas scale-105 z-10"
                      : "opacity-80 hover:opacity-100 hover:scale-102"
                  }`}
                  style={{
                    backgroundColor: linea.colorHex,
                    color: linea.textColorHex,
                  }}
                >
                  {linea.numero}
                </button>

                {/* 3. Ramales correspondientes: se despliegan ÚNICAMENTE si esta línea específica está seleccionada */}
                {isLineSelected && ramales.length > 0 && (
                  <div className="ml-5 pl-2.5 border-l-2 border-hairline/80 flex flex-col items-start gap-1.5 py-1.5 animate-in fade-in slide-in-from-left-2 duration-150">
                    {ramales.map((ramal) => {
                      const letter = getRamalLetter(ramal);
                      const isRamalSelected = selectedRamalId === ramal.id;

                      return (
                        <button
                          key={ramal.id}
                          type="button"
                          onClick={() => {
                            if (isRamalSelected) {
                              // Deseleccionar ramal, mantener la línea
                              onSelectRamal?.(null);
                            } else {
                              // 4. Seleccionar ramal específico (el mapa mostrará solo este recorrido)
                              onSelectLinea(linea.id);
                              onSelectRamal?.(ramal.id);
                            }
                          }}
                          title={`${ramal.codigo}: ${ramal.nombre}`}
                          aria-label={`${ramal.codigo}: ${ramal.nombre}`}
                          className={`w-7 h-7 rounded-full transition-all flex items-center justify-center touch-manipulation shadow-xs ${
                            isRamalSelected
                              ? "bg-ink text-canvas font-bold ring-[1px] ring-ink/80 scale-105 z-10"
                              : "bg-canvas/95 text-ink border border-hairline hover:border-ink/60 hover:bg-canvas-soft"
                          }`}
                        >
                          {/* Letra del ramal con color identificatorio */}
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                              isRamalSelected
                                ? "bg-canvas text-ink"
                                : "text-canvas"
                            }`}
                            style={{
                              backgroundColor: isRamalSelected ? undefined : ramal.color,
                            }}
                          >
                            {letter}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
