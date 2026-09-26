"use client";

import { useState } from "react";
import { Search, X, MapPin, Bus, Radio } from "lucide-react";
import { Linea, Parada } from "@/types/transport";

interface FloatingSearchProps {
  lineas: Linea[];
  paradas: Parada[];
  onSelectLinea: (lineaId: string) => void;
  onSelectParada: (parada: Parada) => void;
}

/**
 * Componente modular FloatingSearch (Fase 4).
 * Barra de búsqueda superior flotante estilo Google Maps con autocompletado reactivo
 * para filtrar líneas y paradas sobre los datos mock.
 */
export default function FloatingSearch({
  lineas,
  paradas,
  onSelectLinea,
  onSelectParada,
}: FloatingSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const cleanQuery = query.trim().toLowerCase();

  const filteredLineas = cleanQuery
    ? lineas.filter(
        (l) =>
          l.numero.toLowerCase().includes(cleanQuery) ||
          l.nombre.toLowerCase().includes(cleanQuery) ||
          l.empresa.toLowerCase().includes(cleanQuery)
      )
    : [];

  const filteredParadas = cleanQuery
    ? paradas.filter(
        (p) =>
          p.nombre.toLowerCase().includes(cleanQuery) ||
          p.direccion.toLowerCase().includes(cleanQuery)
      )
    : [];

  const hasResults = cleanQuery.length > 0 && (filteredLineas.length > 0 || filteredParadas.length > 0);

  return (
    <div className="relative w-full">
      {/* Contenedor nav-pill de búsqueda flotante */}
      <div className="bg-canvas border border-hairline rounded-full px-3.5 py-1.5 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center shrink-0 text-text-muted">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            placeholder="Buscar línea, parada o ramal..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-transparent text-sm font-normal text-ink placeholder:text-text-faint focus:outline-none"
          />

          {query && (
            <button
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="p-1 text-text-muted hover:text-ink transition-colors rounded-full"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desplegable de Resultados de Búsqueda */}
        {isOpen && hasResults && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-canvas border border-hairline rounded-[24px] p-2 max-h-64 overflow-y-auto no-scrollbar space-y-1 z-50">
            {filteredLineas.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-text-muted px-3 py-1 flex items-center gap-1.5">
                  <Bus className="w-3.5 h-3.5" />
                  <span>Línea</span>
                </p>
                {filteredLineas.map((linea) => (
                  <button
                    key={linea.id}
                    onClick={() => {
                      onSelectLinea(linea.id);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-full hover:bg-canvas-soft text-left transition-colors"
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: linea.colorHex, color: linea.textColorHex }}
                    >
                      {linea.numero}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-ink truncate">
                        {linea.nombre}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">{linea.empresa}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredParadas.length > 0 && (
              <div className="mt-1 pt-1 border-t border-hairline-soft">
                <p className="text-[11px] font-semibold text-text-muted px-3 py-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Paradas</span>
                </p>
                {filteredParadas.map((parada) => (
                  <button
                    key={parada.id}
                    onClick={() => {
                      onSelectParada(parada);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-full hover:bg-canvas-soft text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-canvas-soft text-text-muted flex items-center justify-center shrink-0">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-ink truncate">
                        {parada.nombre}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">{parada.direccion}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
