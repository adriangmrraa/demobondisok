'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useRef } from 'react';
import { Home, Map, MapPin, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetropolRose } from '@/components/brand/metropol-logo';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ArrivalPhase } from '@/lib/trip-map-navigation';

/**
 * Bottom nav unificado de Metropol AMBA — 5 items en grid uniforme.
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ [🏠 Inicio] [🗺️ Red Metro] [🔍 ¿Cómo?] [📊 Diagrama] [🌹 En vivo] │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Layout: grid-cols-5 con cada item del mismo ancho. El item 5 (En vivo)
 * usa la Rosa como ícono distintivo, con un círculo de marca y label
 * "En vivo" abajo. La Rosa mantiene los 3 comportamientos legacy
 * (un toque, doble tap, color según arrivalPhase) vía onClick handler
 * con detección de doble tap. NO hay absolute positioning ni FAB
 * elevado (eso descuadraba el grid en mobile portrait 360dp).
 *
 * Cada item navega a su propia ruta:
 *   - Inicio → /inicio
 *   - Red Metro → /red-metro
 *   - ¿Cómo? → /como-llego
 *   - Diagrama → /diagrama
 *   - En vivo (Rosa) → /mapas (con ?trip=1 si doble tap en viaje)
 *
 * Legacy: el query param ?view=X en /mapas ya no se usa (las vistas son
 * páginas separadas). Se mantiene MapViewBanner como fallback para URLs
 * con ?view=red-metro o ?view=diagrama por compatibilidad.
 */

export interface BottomNavProps {
  /** El viaje está activo (la rosa se transforma visualmente). */
  isTripMode?: boolean;
  /** Phase visual del viaje (no controla state machine). */
  arrivalPhase?: ArrivalPhase;
  /** Hay contenido de viaje para alternar (modo Viaje o colectivo seguido). */
  tripToggleActive?: boolean;
  /** Un toque en la rosa alterna la vista del viaje sin perder el estado. */
  onToggleTripView?: () => void;
  /** Doble tap en la rosa cuando el handler externo lo provee. */
  onActivateTripMode?: () => void;
  /** @deprecated Mantenido por compatibilidad. */
  isLineMenuOpen?: boolean;
  /** @deprecated Mantenido por compatibilidad. */
  onToggleLineMenu?: () => void;
}

const DOUBLE_TAP_MS = 320;
const TRIP_QUERY = 'trip=1';

export function BottomNav(props: BottomNavProps) {
  return (
    <Suspense fallback={<BottomNavSkeleton />}>
      <BottomNavInner {...props} />
    </Suspense>
  );
}

/** Fallback del Suspense: nav neutral sin estado activo. */
function BottomNavSkeleton() {
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none"
      aria-label="Navegación principal"
      role="navigation"
    >
      <div className="max-w-[420px] sm:max-w-md mx-auto pointer-events-auto">
        <div className="min-h-[64px] rounded-[28px] border border-hairline bg-canvas shadow-[0_10px_36px_rgba(16,29,61,0.16)] grid grid-cols-5 items-center px-1.5 py-1.5">
          {[Home, Map, Search, Layers, MapPin].map((Icon, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center h-full text-text-muted"
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-[10px] leading-none font-medium">...</span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

function BottomNavInner({
  isTripMode = false,
  arrivalPhase,
  tripToggleActive = false,
  onToggleTripView,
  onActivateTripMode,
}: BottomNavProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const isGreenRide = arrivalPhase === 'VIAJANDO_GREEN';
  const isYellowRide = arrivalPhase === 'VIAJANDO_YELLOW';
  const isCritical = arrivalPhase === 'ARRIBANDO';

  const isInicio = pathname === '/inicio';
  const isRedMetro = pathname === '/red-metro';
  const isComoLlego = pathname === '/como-llego';
  const isDiagrama = pathname === '/diagrama';
  const isEnVivo = pathname === '/mapas';

  const roseBgClass = isTripMode
    ? isGreenRide
      ? 'bg-[var(--viajando-green)]'
      : isYellowRide
        ? 'bg-[var(--viajando-yellow)]'
        : isCritical
          ? 'bg-red-600'
          : 'bg-canvas'
    : dark
      ? 'bg-[#1D2B4F]'
      : 'bg-canvas';

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none"
      aria-label="Navegación principal"
      role="navigation"
    >
      <div className="max-w-[420px] sm:max-w-md mx-auto pointer-events-auto">
        <div className="min-h-[76px] rounded-[28px] border border-hairline bg-canvas shadow-[0_10px_36px_rgba(16,29,61,0.16)] grid grid-cols-5 items-stretch px-1.5 py-1.5">
          <NavItem
            href="/red-metro"
            label="Red Metropol"
            icon={Map}
            active={isRedMetro}
            aria-label="Ver la red metropolitana"
          />
          <NavItem
            href="/como-llego"
            label="¿Cómo llego?"
            icon={Search}
            active={isComoLlego}
            aria-label="Planificar un viaje"
          />
          <RoseNavItem
            href="/mapas"
            label="En vivo"
            active={isEnVivo}
            isTripMode={isTripMode}
            arrivalPhase={arrivalPhase}
            roseBgClass={roseBgClass}
            tripToggleActive={tripToggleActive}
            onToggleTripView={onToggleTripView}
            onActivateTripMode={onActivateTripMode}
            pathname={pathname}
          />
          <NavItem
            href="/diagrama"
            label="Diagrama"
            icon={Layers}
            active={isDiagrama}
            aria-label="Ver diagrama de líneas"
          />
          <NavItem
            href="/inicio"
            label="Inicio"
            icon={Home}
            active={isInicio}
            aria-label="Ir a inicio"
          />
        </div>
      </div>
    </nav>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  className?: string;
  'aria-label'?: string;
}

function NavItem({ href, label, icon: Icon, active, className, 'aria-label': ariaLabel }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col items-center justify-center h-full mx-1 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        active ? 'text-ink' : 'text-text-muted hover:text-ink',
        className,
      )}
      aria-label={ariaLabel ?? label}
      aria-current={active ? 'page' : undefined}
    >
      <div
        className={cn(
          'flex items-center justify-center px-2.5 py-1 rounded-full transition-colors duration-200',
          active ? 'bg-canvas-soft' : 'bg-transparent group-hover:bg-canvas-soft/60',
        )}
      >
        <Icon
          className={cn(
            'w-[22px] h-[22px] transition-transform shrink-0',
            active && 'scale-110',
          )}
        />
      </div>
      <span
        className={cn(
          'text-[10px] leading-tight text-center break-words line-clamp-2 max-w-full px-1 mt-0.5',
          active ? 'font-bold text-ink' : 'font-medium',
        )}
      >
        {label}
      </span>
    </Link>
  );
}

interface RoseNavItemProps {
  href: string;
  label: string;
  active: boolean;
  isTripMode: boolean;
  arrivalPhase?: ArrivalPhase;
  roseBgClass: string;
  tripToggleActive: boolean;
  onToggleTripView?: () => void;
  onActivateTripMode?: () => void;
  pathname: string;
}

/** Item 5 del grid: la Rosa como FAB dentro de la grilla, con label 'En vivo'.
 *  Mantiene los 3 comportamientos legacy (un toque, doble tap, color). */
function RoseNavItem({
  href,
  label,
  active,
  isTripMode,
  arrivalPhase,
  roseBgClass,
  tripToggleActive,
  onToggleTripView,
  onActivateTripMode,
  pathname,
}: RoseNavItemProps) {
  const lastTapRef = useDoubleTap();

  const isGreenRide = arrivalPhase === 'VIAJANDO_GREEN';
  const isYellowRide = arrivalPhase === 'VIAJANDO_YELLOW';
  const isCritical = arrivalPhase === 'ARRIBANDO';
  const roseMono = isTripMode && (isGreenRide || isYellowRide || isCritical);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const { isDouble } = lastTapRef.registerTap();
    if (!isDouble) {
      if (active && tripToggleActive && onToggleTripView) {
        event.preventDefault();
        onToggleTripView();
        return;
      }
      return;
    }
    event.preventDefault();
    if (onActivateTripMode) {
      onActivateTripMode();
      return;
    }
    if (pathname === '/mapas') return;
    const base = pathname.replace(/[?&]trip=1/g, '').replace(/\?$/, '');
    const next = base.includes('?') ? `${base}&${TRIP_QUERY}` : `${base}?${TRIP_QUERY}`;
    window.location.href = next;
  };

  return (
    <Link
      href={href}
      data-active={active}
      onClick={handleClick}
      className={cn(
        'flex flex-col items-center justify-center h-full rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        active ? 'text-ink' : 'text-text-muted hover:text-ink',
      )}
      aria-label={
        active && tripToggleActive
          ? 'Mostrar u ocultar la vista del viaje. Doble toque para abrir Modo Viaje'
          : 'Ir al mapa en vivo. Doble toque para abrir Modo Viaje'
      }
      aria-current={active ? 'page' : undefined}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-[background-color,box-shadow,transform,ring-color] duration-500 [transition-timing-function:cubic-bezier(.16,1,.3,1)] rutaba-rose-btn',
          isTripMode && 'rutaba-rose-trip-morph',
          roseBgClass,
          isTripMode
            ? isGreenRide
              ? 'ring-[var(--viajando-green)] ring-[3px]'
              : isYellowRide
                ? 'ring-[var(--viajando-yellow)] ring-[3px]'
                : isCritical
                  ? 'ring-red-600 ring-[3px]'
                  : 'ring-electric-blue ring-[3px]'
            : active
              ? 'ring-2 ring-ink'
              : 'ring-1 ring-hairline',
        )}
      >
        <MetropolRose
          variant={roseMono ? 'mono' : 'full'}
          className={cn('h-5 w-auto', roseMono && (isYellowRide ? 'text-[#1D2B4F]' : 'text-white'))}
        />
      </div>
      <span
        className={cn(
          'text-[10px] leading-none mt-0.5 truncate max-w-full px-0.5',
          active ? 'font-bold' : 'font-medium',
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function useDoubleTap() {
  const lastTapRef = useRef<number>(0);
  return {
    registerTap: () => {
      const now = Date.now();
      const isDouble = now - lastTapRef.current < DOUBLE_TAP_MS;
      lastTapRef.current = now;
      return { isDouble };
    },
  };
}
