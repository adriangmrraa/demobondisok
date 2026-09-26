"use client";

import React, { useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { HomeHeaderProps } from "@/types/home-navigation";

const emptySubscribe = () => () => {};

function getDynamicGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function getFormattedDate(): string {
  const date = new Date();
  const formatted = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function HomeHeader({
  userName,
  unreadNotificationsCount = 1,
  onOpenNotifications,
}: HomeHeaderProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const greeting = isClient ? getDynamicGreeting() : "¡Buenas!";
  const formattedDate = isClient ? getFormattedDate() : "";

  return (
    <header className="w-full pt-[calc(max(16px,env(safe-area-inset-top))+8px)] pb-4 px-5 flex items-center justify-between bg-canvas/80 backdrop-blur-md sticky top-0 z-30 border-b border-hairline-soft">
      <div className="flex flex-col items-start">
        <h1 suppressHydrationWarning className="text-xl font-extrabold text-ink tracking-tight">
          {userName ? `¡${greeting}, ${userName}! 👋` : `${greeting} 👋`}
        </h1>
        <p suppressHydrationWarning className="text-xs font-medium text-text-muted mt-0.5 min-h-[1.25rem]">
          {formattedDate}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenNotifications}
        title="Centro de notificaciones"
        aria-label="Abrir centro de notificaciones"
        className="relative w-11 h-11 rounded-full bg-canvas-soft border border-hairline flex items-center justify-center text-ink hover:bg-field active:scale-95 transition-all touch-manipulation shadow-sm"
      >
        <Bell className="w-5 h-5 text-ink" />
        {unreadNotificationsCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-electric-blue ring-2 ring-canvas animate-pulse" />
        )}
      </button>
    </header>
  );
}
