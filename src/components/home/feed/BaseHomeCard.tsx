"use client";

import React from "react";
import { BaseCardProps } from "@/types/home-navigation";

export default function BaseHomeCard({
  title,
  children,
  className = "",
}: BaseCardProps) {
  return (
    <section
      className={`w-full bg-canvas border border-hairline rounded-2xl p-4 shadow-sm space-y-3 transition-all ${className}`}
    >
      {title && (
        <h2 className="text-sm font-bold text-ink tracking-tight border-b border-hairline-soft pb-2">
          {title}
        </h2>
      )}
      <div className="w-full">{children}</div>
    </section>
  );
}
