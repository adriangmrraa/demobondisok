"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Colapso por arrastre (dedos en mobile, mouse en PC).
 * Usa Pointer Events (unifica mouse/touch/pen) + snap al soltar.
 * El handle debe tener `touch-action: none` para que el browser no
 * compita con el scroll nativo durante el gesto.
 */
export function useDragCollapse(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const movedY = useRef(0);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Solo botón principal en mouse; táctil siempre.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startY.current = e.clientY;
    movedY.current = 0;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!e.buttons && e.pointerType === "mouse") return;
    movedY.current = e.clientY - startY.current;
  }, []);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    const dy = movedY.current;
    // Umbral 24px: arrastre claro hacia abajo colapsa, hacia arriba expande.
    // Tap (<24px) lo maneja onClick del handle (toggle).
    if (dy > 24) setCollapsed(true);
    else if (dy < -24) setCollapsed(false);
    movedY.current = 0;
  }, []);

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { touchAction: "none" as const, cursor: dragging ? "grabbing" : "grab" },
  };

  return { collapsed, setCollapsed, toggle, dragging, handleProps };
}
