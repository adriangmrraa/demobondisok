"use client";

import React, { useState } from "react";
import HomeHeader from "./HomeHeader";
import NotificationDrawer from "./NotificationDrawer";
import HomeCardFeed from "./feed/HomeCardFeed";

export default function HomeScreen() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="w-full min-h-screen bg-canvas text-foreground flex flex-col items-center">
      {/* Header Superior (Saludo, Fecha y Notificaciones) */}
      <HomeHeader
        onOpenNotifications={() => setIsNotificationOpen(true)}
      />

      {/* Drawer deslizante de Notificaciones */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />

      {/* Feed Central de Tarjetas Modulares */}
      <HomeCardFeed />
    </div>
  );
}
