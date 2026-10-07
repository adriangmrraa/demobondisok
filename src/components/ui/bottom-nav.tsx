'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Home, Map, MapPin, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetropolRose } from '@/components/brand/metropol-logo';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ArrivalPhase } from '@/lib/trip-map-navigation';

/**
 * Bottom nav unificado de Metropol AMBA — 5 items.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [🏠 Inicio] [🗺️ Red Metro] [🔍 ¿Cómo llego?] [🌹 En vivo] [📊 Diagrama] │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Estructura: el FAB central (la rosa) representa "En vivo" y conserva los
 * 3 comportamientos legacy (un toque, doble tap, color según arrivalPhase).
 * Los 4 tabs laterales son Link directos a /mapas?view=X (excepto Inicio).
 *
 * Las 4 vistas se mapean al query param `view`:
 *   - view=en-vivo (default): mapa con colectivos.
 *   - view=red-metro: vista territorial con municipios (placeholder).
 *   - view=como-llego: wizard de viaje (placeholder mientras se implementa).
 *   - view=diagrama: esquema de líneas tipo Moovit/SUBE (placeholder).
 *
 * Props legacy (`isLineMenuOpen`, `onToggleLineMenu`) se mantienen para
 * no romper consumidores existentes pero ya no se usan en el render.
 */

export type BottomNavView = 'inicio' | 'red-metro' | 'como-llego' | 'en-vivo' | 'diagrama';

export interface BottomNavProps {
  /** @deprecated Mantenido por compatibilidad. La lógica de líneas vive en el LineSelectorBar del mapa. */
  isLineMenuOpen?: boolean;
  /** @deprecated Mantenido por compatibilidad. */
  onToggleLineMenu?: () => void;
  /** Doble tap en la rosa cuando el handler externo lo provee. */
  onActivateTripMode?: () => void;
  /** El viaje está activo (la rosa se transforma visualmente). */
  isTripMode?: boolean;
  /** Phase visual del viaje (no controla state machine). */
  arrivalPhase?: ArrivalPhase;
  /** Hay contenido de viaje para alternar (modo Viaje o colectivo seguido). */
  tripToggleActive?: boolean;
  /** Un toque en la rosa alterna la vista del viaje sin perder el estado. */
  onToggleTripView?: () => void;
}

const DOUBLE_TAP_MS = 320;
const TRIP_QUERY = 'trip=1';

const VIEW_PARAM: Record<Exclude<BottomNavView, 'inicio'>, string> = {
  'red-metro': 'red-metro',
  'como-llego': 'como-llego',
  'en-vivo': 'en-vivo',
  'diagrama': 'diagrama',
};

function currentView(pathname: string, viewParam: string | null): BottomNavView {
  if (pathname === '/inicio') return 'inicio';
  if (pathname === '/mapas') {
    if (viewParam === 'red-metro') return 'red-metro';
    if (viewParam === 'como-llego') return 'como-llego';
    if (viewParam === 'diagrama') return 'diagrama';
    return 'en-vivo';
  }
  return 'en-vivo';
}

export function BottomNav({
  onActivateTripMode,
  isTripMode = false,
  arrivalPhase,
  tripToggleActive = false,
  onToggleTripView,
}: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const lastTapRef = useRef<number>(0);
  const onMap = pathname === '/mapas';
  const view = currentView(pathname, searchParams.get('view'));
  const dark = resolvedTheme === 'dark';

  const isGreenRide = arrivalPhase === 'VIAJANDO_GREEN';
  const isYellowRide = arrivalPhase === 'VIAJANDO_YELLOW';
  const isCritical = arrivalPhase === 'ARRIBANDO';

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
      : 'bg-white';

  const roseRingClass = isTripMode
    ? isGreenRide
      ? 'ring-[var(--viajando-green)] ring-[5px]'
      : isYellowRide
        ? 'ring-[var(--viajando-yellow)] ring-[5px]'
        : isCritical
          ? 'ring-red-600 ring-[5px]'
          : 'ring-electric-blue ring-[5px]'
    : dark
      ? 'ring-[#1D2B4F] ring-4'
      : 'ring-white ring-4';

  const roseMono = isTripMode && (isGreenRide || isYellowRide || isCritical);
  const enVivoActive = view === 'en-vivo';

  const handleRoseClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now();
    const isDouble = now - lastTapRef.current < DOUBLE_TAP_MS;
    lastTapRef.current = now;

    if (!isDouble) {
      if (onMap && tripToggleActive && onToggleTripView) {
        event.preventDefault();
        onToggleTripView();
        return;
      }
      if (!onMap) return;
      // Si no estamos en En vivo, llevar al usuario allá
      if (view !== 'en-vivo') {
        event.preventDefault();
        router.push('/mapas');
      }
      return;
    }

    event.preventDefault();
    lastTapRef.current = 0;

    if (onActivateTripMode) {
      onActivateTripMode();
      return;
    }

    if (onMap) return;
    const base = pathname.replace(/[?&]trip=1/g, '').replace(/\?$/, '');
    const next = base.includes('?') ? `${base}&${TRIP_QUERY}` : `${base}?${TRIP_QUERY}`;
    router.push(next);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none"
      aria-label="Navegación principal"
      role="navigation"
    >
      <div className="max-w-[420px] sm:max-w-md mx-auto relative pointer-events-auto">
        <div className="relative h-[68px] rounded-[28px] border border-hairline bg-canvas shadow-[0_10px_36px_rgba(16,29,61,0.16)]">
          <div className="grid grid-cols-[1fr_1fr_56px_1fr_1fr] h-full items-stretch px-1.5">
            <NavItem
              href="/inicio"
              label="Inicio"
              icon={Home}
              active={view === 'inicio'}
              aria-label="Ir a inicio"
            />
            <NavItem
              href={`/mapas?view=${VIEW_PARAM['red-metro']}`}
              label="Red Metro"
              icon={Map}
              active={view === 'red-metro'}
              aria-label="Ver la red metropolitana"
            />
            <NavItem
              href={`/mapas?view=${VIEW_PARAM['como-llego']}`}
              label="¿Cómo llego?"
              icon={Search}
              active={view === 'como-llego'}
              aria-label="Planificar un viaje"
              className="truncate"
            />

            {/* Spacer central bajo la rosa FAB */}
            <div aria-hidden className="w-[56px] shrink-0" />

            <NavItem
              href={`/mapas?view=${VIEW_PARAM.diagrama}`}
              label="Diagrama"
              icon={Layers}
              active={view === 'diagrama'}
              aria-label="Ver diagrama de líneas"
            />
            <NavItem
              href={`/mapas?view=${VIEW_PARAM['en-vivo']}`}
              label="En vivo"
              icon={MapPin}
              active={enVivoActive}
              aria-label="Ver mapa en vivo"
            />
          </div>

          {/* Rosa elevada al centro exacto → En vivo (doble tap: Modo Viaje) */}
          <Link
            href={`/mapas?view=${VIEW_PARAM['en-vivo']}`}
            data-active={enVivoActive}
            onClick={handleRoseClick}
            className={cn(
              'absolute left-3/5 -translate-x-1/2 -top-4 z-10 flex flex-col items-center justify-center w-[60px] h-[60px] rounded-full active:scale-95 transition-[background-color,box-shadow,transform,ring-color] duration-500 [transition-timing-function:cubic-bezier(.16,1,.3,1)] rutaba-rose-btn touch-manipulation',
              isTripMode && 'rutaba-rose-trip-morph',
              roseBgClass,
              roseRingClass,
            )}
            aria-label={
              onMap && tripToggleActive
                ? 'Mostrar u ocultar la vista del viaje. Doble toque para abrir Modo Viaje'
                : 'Ir al mapa en vivo. Doble toque para abrir Modo Viaje'
            }
            aria-current={enVivoActive ? 'page' : undefined}
          >
            <MetropolRose
              variant={roseMono ? 'mono' : 'full'}
              className={cn('h-7 w-auto', roseMono && (isYellowRide ? 'text-[#1D2B4F]' : 'text-white'))}
            />
          </Link>
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
        'flex flex-col items-center justify-center h-full rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
        active ? 'text-ink' : 'text-text-muted hover:text-ink',
        className,
      )}
      aria-label={ariaLabel ?? label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'w-5 h-5 mb-0.5 transition-transform shrink-0',
          active && 'scale-110',
        )}
      />
      <span
        className={cn(
          'text-[10px] leading-none truncate max-w-full px-0.5',
          active ? 'font-bold' : 'font-medium',
        )}
      >
        {label}
      </span>
    </Link>
  );
}
