/**
 * Pantalla Próximas Llegadas — /parada/[id]
 * Port simplificado: arrivals deterministas (hash, igual que /inicio),
 * useFavorites del destino. Sin Toast ni use-notifications (no existen aún).
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Bell, BellRing, CheckCircle2 } from 'lucide-react';
import { ArrivalCard } from '@/components/ui/arrival-card';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MOCK_STOPS, MOCK_LINES } from '@/mock/data';
import { useFavorites } from '@/hooks/use-favorites';

function hashOf(s: string): number {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

interface Arrival {
  lineId: string;
  lineName: string;
  lineDirection: string;
  lineColor: string;
  etaMin: number;
  live: boolean;
}

function buildArrivals(stopId: string, refreshKey: number): Arrival[] {
  const stop = MOCK_STOPS.find((s) => s.id === stopId);
  if (!stop) return [];
  return stop.lineIds
    .map((lineId, i) => {
      const line = MOCK_LINES.find((l) => l.id === lineId);
      if (!line) return null;
      const etaMin = ((hashOf(stopId + lineId) + refreshKey * 7 + i * 3) % 12) + 1;
      return {
        lineId,
        lineName: line.shortName,
        lineDirection: line.direction,
        lineColor: line.color,
        etaMin,
        live: true,
      };
    })
    .filter((a): a is Arrival => a !== null);
}

export default function ParadaPage() {
  const params = useParams();
  const router = useRouter();
  const stopId = params.id as string;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [refreshKey, setRefreshKey] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [notified, setNotified] = useState(false);
  const [notifyError, setNotifyError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const dialogRef = useRef<HTMLDivElement>(null);

  const stop = MOCK_STOPS.find((s) => s.id === stopId);
  const dialogLine = stop
    ? MOCK_LINES.find((l) => l.id === stop.lineIds[0]) ?? null
    : null;

  const arrivals = useMemo(
    () => buildArrivals(stopId, refreshKey),
    [stopId, refreshKey],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showSheet) return;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSheet(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSheet]);

  const filtered = liveOnly ? arrivals.filter((a) => a.live) : arrivals;

  const handleNotify = async () => {
    if (!dialogLine) return;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'denied') {
          setNotifyError(true);
          return;
        }
      } catch {
        setNotifyError(true);
        return;
      }
    }
    setNotifyError(false);
    setNotified(true);
    setShowSheet(false);
  };

  if (!stop) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-text-muted">Parada no encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <header className="bg-canvas flex items-center px-4 h-12 w-full fixed top-0 z-50 border-b border-hairline-soft shadow-sm">
        <button
          onClick={() => router.back()}
          className="h-12 w-12 flex items-center justify-center text-ink hover:bg-canvas-soft transition-colors rounded-full"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 px-2">
          <h1 className="text-[20px] font-semibold text-ink truncate">{stop.name}</h1>
          <p className="text-xs text-text-muted">
            {arrivals.length} llegadas disponibles
          </p>
        </div>
        <button
          onClick={() => toggleFavorite(stopId)}
          aria-pressed={isFavorite(stopId)}
          aria-label={isFavorite(stopId) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          className={`h-12 w-12 flex items-center justify-center rounded-full transition-colors ${
            isFavorite(stopId)
              ? 'text-ink hover:bg-canvas-soft'
              : 'text-text-muted hover:bg-canvas-soft'
          }`}
        >
          <Star
            className={`w-6 h-6 ${isFavorite(stopId) ? 'fill-current' : ''}`}
          />
        </button>
      </header>

      <main className="px-4 mt-16 space-y-4 max-w-2xl mx-auto">
        <button
          onClick={() => setLiveOnly(!liveOnly)}
          className={`h-10 px-4 rounded-full border text-sm font-semibold transition-all active:scale-95 ${
            liveOnly
              ? 'bg-ink text-canvas border-ink'
              : 'bg-transparent text-ink border-hairline'
          }`}
        >
          {liveOnly ? '✓ En vivo' : 'Solo en vivo'}
        </button>

        {arrivals.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-hairline bg-canvas-soft p-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-canvas" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-canvas rounded" />
                    <div className="h-3 w-16 bg-canvas rounded" />
                  </div>
                  <div className="h-6 w-12 bg-canvas rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((arrival, i) => (
              <ArrivalCard
                key={`${arrival.lineId}-${i}`}
                lineName={arrival.lineName}
                lineDirection={arrival.lineDirection}
                lineColor={arrival.lineColor}
                etaMin={arrival.etaMin}
                live={arrival.live}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-text-muted py-8">
                {liveOnly
                  ? 'No hay llegadas en vivo en este momento'
                  : 'No hay llegadas registradas'}
              </p>
            )}
          </div>
        )}

        {!notified && (
          <button
            onClick={() => setShowSheet(true)}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-ink text-canvas p-4 text-sm font-semibold hover:opacity-90 transition-colors active:scale-[0.98] min-h-[48px]"
          >
            <Bell className="w-4 h-4" aria-hidden />
            ¿Te avisamos cuando llegue?
          </button>
        )}

        {notified && (
          <div className="rounded-lg bg-[#dcfce7]/40 border border-[#16a34a]/30 p-3 text-center flex items-center justify-between gap-3">
            <p className="text-sm text-[#16a34a] font-medium flex-1 text-left flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
              Aviso activado
              <span className="block text-xs mt-0.5 text-text-muted">
                {dialogLine
                  ? `Línea ${dialogLine.shortName} · ${stop.name}`
                  : stop.name}
              </span>
            </p>
            <button
              onClick={() => setNotified(false)}
              className="min-h-9 px-3 rounded-full text-xs font-semibold text-text-muted hover:bg-canvas-soft border border-hairline transition-colors shrink-0"
            >
              Desactivar
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-text-faint">
            Última actualización:{' '}
            {lastUpdate.toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <button
            onClick={() => {
              setRefreshKey((k) => k + 1);
              setLastUpdate(new Date());
            }}
            className="text-xs font-semibold text-ink hover:underline"
            aria-label="Actualizar llegadas"
          >
            Actualizar
          </button>
        </div>
      </main>

      {showSheet && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setShowSheet(false)}
            aria-hidden
          />

          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notify-dialog-title"
            className="relative w-full max-w-sm bg-canvas rounded-3xl p-6 shadow-2xl animate-slide-up outline-none max-h-[85dvh] overflow-y-auto border border-hairline"
          >
            {dialogLine && (
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm text-white"
                  style={{ backgroundColor: dialogLine.color }}
                >
                  {dialogLine.shortName}
                </div>
                <div>
                  <p className="font-semibold text-ink">
                    Línea {dialogLine.shortName} · {dialogLine.direction}
                  </p>
                  <p className="text-xs text-text-muted">{stop.name}</p>
                </div>
              </div>
            )}

            <h3 id="notify-dialog-title" className="text-lg font-bold text-ink mb-2">
              ¿Te avisamos cuando llegue?
            </h3>
            <p className="text-sm text-text-muted mb-6">
              Te enviamos una notificación cuando la Línea{' '}
              {dialogLine?.shortName ?? ''} esté a 2 minutos de &apos;
              {stop.name}&apos;.
            </p>

            {notifyError && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4"
              >
                Las notificaciones están bloqueadas en el navegador. Activalas
                desde el candado de la barra de direcciones y volvé a intentar.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowSheet(false)}
                className="flex-1 rounded-lg border border-hairline p-3 text-sm font-semibold text-ink hover:bg-canvas-soft transition-colors min-h-[48px]"
              >
                Quizás después
              </button>
              <button
                onClick={handleNotify}
                className="flex-1 rounded-lg bg-ink text-canvas p-3 text-sm font-semibold hover:opacity-90 transition-colors min-h-[48px] flex items-center justify-center gap-2"
              >
                <BellRing className="w-4 h-4" aria-hidden />
                Activar aviso
              </button>
            </div>

            <p className="text-xs text-text-faint text-center mt-4">
              Usás notificaciones push: no gastás datos ni batería.
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
