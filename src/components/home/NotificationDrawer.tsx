"use client";

import React from "react";
import { X, AlertTriangle, Info, BellRing } from "lucide-react";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOCK_NOTIFICATIONS = [
  {
    id: "notif-1",
    type: "warning",
    title: "Línea 194 • Ramal Zárate Expreso",
    description: "Demoras de 10 min por trabajos de repavimentación en Av. Cabildo.",
    time: "Hace 15 min",
  },
  {
    id: "notif-2",
    type: "info",
    title: "Nueva Frecuencia de Turno Tarde",
    description: "La Línea 65 incorporó 4 nuevas unidades en hora pico.",
    time: "Hace 2 horas",
  },
];

export default function NotificationDrawer({
  isOpen,
  onClose,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm h-full bg-canvas border-l border-hairline p-5 flex flex-col shadow-2xl animate-slide-in-right overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Centro de notificaciones"
      >
        <div className="flex items-center justify-between pb-4 border-b border-hairline-soft">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-electric-blue" />
            <h2 className="text-base font-bold text-ink">Notificaciones</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar notificaciones"
            className="w-9 h-9 rounded-full bg-canvas-soft flex items-center justify-center text-text-muted hover:text-ink active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 py-4 space-y-3">
          {MOCK_NOTIFICATIONS.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-canvas-soft border border-hairline-soft flex items-start gap-3 shadow-sm"
            >
              {item.type === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-electric-blue shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-xs font-bold text-ink">{item.title}</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {item.description}
                </p>
                <span className="text-[10px] text-text-faint mt-2 block">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
