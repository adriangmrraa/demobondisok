import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type LineDisplaySize = 'sm' | 'md' | 'lg' | 'xl';

export interface LineDisplayProps {
  /** Número de la línea (ej. "65", "194", "65 (Troncal)"). */
  number: string;
  /** Color de fondo de la línea. */
  color: string;
  /** Color del texto. Default: blanco para contraste sobre color saturado. */
  textColor?: string;
  /** Tamaño: sm (32px) · md (48px) · lg (64px) · xl (96px). Default: md. */
  size?: LineDisplaySize;
  className?: string;
  /** Orbe flotante 3D: haz de luz del color + sombra de piso + textura. */
  floating?: boolean;
  /** Label accesible (default: "Línea {number}"). */
  'aria-label'?: string;
}

const SIZE_CLASSES: Record<LineDisplaySize, { container: string; text: string }> = {
  sm: { container: 'w-8 h-8 text-[14px]', text: 'text-[14px]' },
  md: { container: 'w-12 h-12 text-base', text: 'text-base' },
  lg: { container: 'w-16 h-16 text-xl', text: 'text-xl' },
  xl: { container: 'w-24 h-24 text-5xl', text: 'text-5xl' },
};

/**
 * Display de número de línea con el color de la marca.
 * Usado en hero de viaje y en superficies que necesitan presencia
 * fuerte de la línea (vs. el LineBadge que es compacto).
 */
export function LineDisplay({
  number,
  color,
  textColor = '#FFFFFF',
  size = 'md',
  floating = false,
  className,
  'aria-label': ariaLabel,
}: LineDisplayProps) {
  const sizing = SIZE_CLASSES[size];
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Línea ${number}`}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-black text-center shadow-2xs shrink-0 tabular-nums',
        sizing.container,
        sizing.text,
        floating && 'line-orb',
        className,
      )}
      style={{ backgroundColor: color, color: textColor, ...(floating ? ({ '--lc': color } as CSSProperties) : {}) }}
    >
      {number}
    </span>
  );
}
