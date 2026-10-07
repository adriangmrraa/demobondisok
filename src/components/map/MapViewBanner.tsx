'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Construction, ArrowLeft } from 'lucide-react';

type ViewKey = 'en-vivo' | 'red-metro' | 'como-llego' | 'diagrama';

const VIEW_LABELS: Record<Exclude<ViewKey, 'en-vivo'>, { title: string; copy: string }> = {
  'red-metro': {
    title: 'Red Metro',
    copy: 'La vista territorial con municipios coloreados está en construcción. Mientras tanto, mirá el mapa en vivo.',
  },
  'como-llego': {
    title: '¿Cómo llego?',
    copy: 'El wizard de planificación se está integrando con el mapa. Mientras tanto, usá el planificador desde Inicio.',
  },
  'diagrama': {
    title: 'Diagrama',
    copy: 'La vista esquema de líneas (estilo Moovit/SUBE) está en construcción. Mientras tanto, mirá el mapa en vivo.',
  },
};

function MapViewBannerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = (searchParams.get('view') ?? 'en-vivo') as ViewKey;

  if (view === 'en-vivo' || view === 'como-llego') return null;

  const meta = VIEW_LABELS[view as Exclude<ViewKey, 'en-vivo'>];
  if (!meta) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute top-[max(14px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-32px)] max-w-md mx-auto"
    >
      <div className="bg-canvas border-2 border-electric-blue rounded-2xl shadow-[0_8px_24px_-4px_rgba(16,29,61,0.18)] p-3.5 flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-electric-blue/10 flex items-center justify-center">
          <Construction className="w-4.5 h-4.5 text-electric-blue" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink leading-tight">{meta.title}</p>
          <p className="mt-1 text-xs text-text-muted leading-snug break-words line-clamp-3">
            {meta.copy}
          </p>
          <button
            type="button"
            onClick={() => router.push('/mapas')}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-electric-blue hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Volver a En vivo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Banner que se muestra cuando el view del mapa no es 'en-vivo' o 'como-llego'.
 *  Envuelto en Suspense porque usa useSearchParams (regla de Next.js 16). */
export function MapViewBanner() {
  return (
    <Suspense fallback={null}>
      <MapViewBannerInner />
    </Suspense>
  );
}
