import React from "react";

export interface HomeHeaderProps {
  userName?: string;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
}

export interface BaseCardProps {
  id: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export type HomeCardId =
  | "favorite-stops"
  | "line-status"
  | "recent-trips"
  | "service-alerts";

export interface HomeCardProps {
  id: HomeCardId;
  title?: string;
  className?: string;
}
