/**
 * Pantalla Alertas — /alertas
 * Port desde colectivos-amba: lucide-react + tokens DESIGN.MD (no MD3).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  Map as MapIcon,
  ChevronRight,
  CheckCircle2,
  Smile,
} from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { LineBadge } from '@/components/ui/line-badge';
import { MOCK_LINES, MOCK_ALERTS } from '@/mock/data';
import type { Alert } from '@/lib/data-service';

type AlertFilter = 'all' | 'mine';

const FILTERS: { key: AlertFilter; label: string }[] = [
  { key: 'all', label: 'Todas las líneas' },
  { key: 'mine', label: 'Mis líneas' },
];

const STRIP_COLOR: Record<Alert['type'] | 'resolved', string> = {
  delay: 'bg-ink',
  suspension: 'bg-destructive',
  route_change: 'bg-ink',
  resolved: 'bg-[#16a34a]',
};

export default function AlertasPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<AlertFilter>('all');

  const alerts = MOCK_ALERTS.filter((alert) => {
    if (activeFilter === 'mine') {
      return ['line-65', 'line-194'].includes(alert.lineId);
    }
    return true;
  });

  const getLine = (lineId: string) => MOCK_LINES.find((l) => l.id === lineId);

  return (
    <div className="h-dvh overflow-hidden bg-canvas flex flex-col">
      <header className="flex justify-between items-center px-4 h-12 w-full shrink-0 bg-canvas pt-4 pb-2 border-b border-hairline-soft">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-ink" aria-hidden />
          <h1 className="text-[22px] font-bold text-ink tracking-tight">
            Alertas de servicio
          </h1>
        </div>
        <button
          aria-label="Buscar alertas"
          className="w-12 h-12 flex items-center justify-center text-ink active:scale-95 rounded-full hover:bg-canvas-soft transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 flex flex-col gap-4 max-w-2xl mx-auto relative z-10 pt-4 pb-28 flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <section className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`h-12 px-4 rounded-full text-sm font-semibold whitespace-nowrap active:scale-95 flex items-center justify-center border transition-colors ${
                activeFilter === filter.key
                  ? 'bg-ink text-canvas border-transparent'
                  : 'bg-transparent text-text-muted border-hairline hover:bg-canvas-soft'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        <section className="flex flex-col gap-4 mt-2">
          {alerts.map((alert) => {
            const line = getLine(alert.lineId);
            const resolved = alert.status === 'resolved';
            const strip = resolved ? STRIP_COLOR.resolved : STRIP_COLOR[alert.type];

            return (
              <Link
                key={alert.id}
                href={`/alerta/${alert.id}`}
                aria-label={`Ver informe: ${alert.title}`}
                className="bg-canvas rounded-xl border border-hairline shadow-sm p-2 relative overflow-hidden active:scale-[0.98] transition-transform duration-150 flex flex-col"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${strip}`} />

                <div className="flex gap-4 p-2 items-start">
                  {line && <LineBadge shortName={line.shortName} color={line.color} />}

                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h2 className="text-[20px] font-semibold text-ink">
                        {alert.title}
                      </h2>
                      {alert.since && (
                        <span
                          className={
                            resolved
                              ? 'text-xs font-medium text-[#16a34a] bg-[#dcfce7] px-2 py-1 rounded-full whitespace-nowrap border border-[#16a34a]/30'
                              : 'text-xs font-medium text-ink bg-canvas-soft px-2 py-1 rounded-full whitespace-nowrap border border-hairline'
                          }
                        >
                          {resolved ? `Normalizado ${alert.since}` : `Desde ${alert.since}`}
                        </span>
                      )}
                    </div>
                    <p className="text-base text-text-muted leading-snug">
                      {alert.description}
                    </p>
                    {!resolved && (
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push('/mapas');
                        }}
                        className="mt-2 self-start flex items-center gap-1 text-ink text-sm font-semibold hover:underline"
                      >
                        <MapIcon className="w-4 h-4" aria-hidden />
                        Ver en mapa
                      </span>
                    )}
                    {resolved && (
                      <div className="mt-1 flex items-center gap-1 text-[#16a34a]">
                        <CheckCircle2 className="w-4 h-4" aria-hidden />
                        <span className="text-sm font-medium">Servicio normalizado</span>
                      </div>
                    )}
                  </div>

                  <ChevronRight
                    className="w-5 h-5 text-text-faint self-center shrink-0"
                    aria-hidden
                  />
                </div>
              </Link>
            );
          })}

          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <Smile className="w-16 h-16 text-text-faint mb-4 opacity-50" aria-hidden />
              <p className="text-lg text-text-muted max-w-[250px]">
                Todo tranqui, no hay alertas para tus líneas guardadas.
              </p>
            </div>
          )}
        </section>
      </main>

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
