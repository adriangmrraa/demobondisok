"use client";

import React from "react";
import BaseHomeCard from "./BaseHomeCard";
import { Bus, MapPin, Clock, ArrowRight } from "lucide-react";

export function FavoriteStopsCard() {
  return (
    <BaseHomeCard id="favorite-stops" title="Tus Paradas Frecuentes">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-canvas-soft border border-hairline-soft">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-electric-blue/10 text-electric-blue flex items-center justify-center font-bold text-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Plaza de la República (Obelisco)</p>
              <p className="text-[11px] text-text-muted">Línea 200 • Ida a Sur</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-canvas text-xs font-semibold text-electric-blue border border-hairline-soft">
            3 min
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-canvas-soft border border-hairline-soft">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Av. Corrientes y Suipacha</p>
              <p className="text-[11px] text-text-muted">Línea 65 • Constitución</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-canvas text-xs font-semibold text-emerald-600 border border-hairline-soft">
            7 min
          </span>
        </div>
      </div>
    </BaseHomeCard>
  );
}

export function LineStatusCard() {
  return (
    <BaseHomeCard id="line-status" title="Estado del Servicio de Red">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-canvas-soft border border-hairline-soft flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-xs shrink-0">
            65
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-ink truncate">Línea 65</p>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Normal
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-canvas-soft border border-hairline-soft flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-800 text-white flex items-center justify-center font-black text-xs shrink-0">
            194
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-ink truncate">Línea 194</p>
            <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Con Demoras
            </p>
          </div>
        </div>
      </div>
    </BaseHomeCard>
  );
}

export function RecentTripsCard() {
  return (
    <BaseHomeCard id="recent-trips" title="Últimos Recorridos">
      <div className="p-3 rounded-xl bg-canvas-soft border border-hairline-soft flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-text-muted" />
          <div>
            <p className="text-xs font-semibold text-ink">Plaza Italia ➔ Escobar</p>
            <p className="text-[10px] text-text-muted">Ayer a las 18:30 hs</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-text-muted" />
      </div>
    </BaseHomeCard>
  );
}

export default function HomeCardFeed() {
  return (
    <main className="w-full max-w-lg mx-auto px-4 py-4 space-y-4 pb-28">
      {/* Slot 1: Tarjeta de Paradas Frecuentes */}
      <FavoriteStopsCard />

      {/* Slot 2: Tarjeta de Estado de Líneas */}
      <LineStatusCard />

      {/* Slot 3: Tarjeta de Últimos Recorridos */}
      <RecentTripsCard />
    </main>
  );
}
