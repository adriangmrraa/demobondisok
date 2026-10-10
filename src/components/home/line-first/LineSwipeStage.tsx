'use client';

import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const SWIPE_COMMIT_PX = 48;
const AXIS_LOCK_PX = 10;

interface LineSwipeStageProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Zona del bloque de información de la línea (arribos, bajo el mapa). Un swipe
 * horizontal cambia de línea: izquierda = siguiente, derecha = anterior. El
 * cambio se refleja en el chip seleccionado y en los colores del carrusel.
 *
 * REGLA DURA (docs/INCIDENTE-MAPA-iOS-SAFARI.md): durante el gesto NO se traduce
 * el contenido — nada de transform sobre ancestros del canvas WebGL. El feedback
 * es el propio re-render con la nueva línea.
 */
export function LineSwipeStage({ onSwipeLeft, onSwipeRight, className, children }: LineSwipeStageProps) {
  const startRef = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; id: number } | null>(null);
  const suppressClickRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY, axis: null, id: event.pointerId };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (start.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (start.axis === 'x') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Puntero ya inactivo (touch cancelado): seguimos sin captura.
        }
      }
    }
  };

  const endSwipe = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || start.axis !== 'x') return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < SWIPE_COMMIT_PX) return;
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 250);
    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <div
      className={cn('touch-pan-y', className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={() => {
        startRef.current = null;
      }}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
