/**
 * Pantalla Informe de Servicio — /alerta/[id]
 * Port simplificado: buildServiceReport inline con mocks del destino
 * (sin service-reports ni combinationsByStop del origen).
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Map as MapIcon,
  Bus,
} from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { LineBadge } from '@/components/ui/line-badge';
import { MOCK_ALERTS, MOCK_LINES, MOCK_LINE_STOPS, MOCK_STOPS } from '@/mock/data';
import type { Alert, Line } from '@/lib/data-service';
import { cn } from '@/lib/utils';

const TIPO_LABEL: Record<Alert['type'], string> = {
  delay: 'Retraso en el servicio',
  suspension: 'Servicio suspendido',
  route_change: 'Desvío en el recorrido',
};

const MOTIVO_EXTENDIDO: Record<Alert['type'], string> = {
  delay:
    'El personal de vía está trabajando en la zona y los colectivos circulando demoran su paso. La normalización es progresiva: los primeros servicios ya están recuperando frecuencia.',
  suspension:
    'No hay servicio en el tramo afectado hasta nuevo aviso. Se recomienda planificar el viaje con líneas alternativas y volver a consultar antes de salir.',
  route_change:
    'Los colectivos circulan por el recorrido alternativo y las paradas del tramo desviado no efectúan ascenso ni descenso. Consultá las paradas activas más abajo.',
};

interface ReportTimelineItem {
  hora: string;
  label: string;
}

interface ServiceReport {
  alert: Alert;
  line: Line;
  tipoLabel: string;
  motivo: string;
  afectados: { stopId: string; name: string }[];
  alternativas: { lineId: string; shortName: string; color: string; stopName: string }[];
  timeline: ReportTimelineItem[];
  resolved: boolean;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildServiceReport(alertId: string): ServiceReport | null {
  const alert = MOCK_ALERTS.find((a) => a.id === alertId);
  const line = alert ? MOCK_LINES.find((l) => l.id === alert.lineId) : undefined;
  if (!alert || !line) return null;

  const stopIds = MOCK_LINE_STOPS[alert.lineId] ?? [];
  const afectados = stopIds
    .slice(1, Math.max(2, stopIds.length - 1))
    .map((id) => {
      const stop = MOCK_STOPS.find((s) => s.id === id);
      return stop ? { stopId: stop.id, name: stop.name } : null;
    })
    .filter((s): s is { stopId: string; name: string } => s !== null);

  // Alternativas: otras líneas que comparten paradas con esta
  const sharedStopIds = new Set(
    MOCK_STOPS.filter((s) => s.lineIds.includes(alert.lineId)).map((s) => s.id),
  );
  const alternativas = MOCK_STOPS
    .filter((s) => sharedStopIds.has(s.id))
    .flatMap((s) =>
      MOCK_LINES
        .filter((l) => l.id !== alert.lineId && s.lineIds.includes(l.id))
        .map((l) => ({
          lineId: l.id,
          shortName: l.shortName,
          color: l.color,
          stopName: s.name,
        })),
    )
    .slice(0, 6);

  const resolved = alert.status === 'resolved';
  const timeline: ReportTimelineItem[] = [];
  if (alert.since) {
    if (resolved) {
      timeline.push({
        hora: addMinutes(alert.since, -120),
        label: 'Reportado por el personal de vía',
      });
      timeline.push({
        hora: addMinutes(alert.since, -90),
        label: 'Confirmado por Monitoreo',
      });
    } else {
      timeline.push({ hora: alert.since, label: 'Reportado por el personal de vía' });
      timeline.push({ hora: addMinutes(alert.since, 12), label: 'Confirmado por Monitoreo' });
    }
  }
  if (resolved) {
    timeline.push({ hora: alert.since ?? '—', label: 'Servicio normalizado' });
  } else {
    timeline.push({
      hora: 'Ahora',
      label:
        alert.type === 'suspension'
          ? 'Sin servicio en el tramo afectado'
          : alert.type === 'route_change'
            ? 'Recorrido alterado en curso'
            : 'Servicio operando con demoras',
    });
  }

  return {
    alert,
    line,
    tipoLabel: resolved ? 'Servicio normalizado' : TIPO_LABEL[alert.type],
    motivo: resolved
      ? `${alert.description} La incidencia quedó cerrada y los servicios de la línea circulan con frecuencias normales en todo el recorrido. Ante cualquier novedad, esta pantalla vuelve a actualizarse.`
      : `${alert.description} ${MOTIVO_EXTENDIDO[alert.type]}`,
    afectados,
    alternativas,
    timeline,
    resolved,
  };
}

const SEVERITY_META = {
  amber: { pill: 'bg-[#F59E0B]/15 text-[#855300] border-[#F59E0B]/30', dot: 'bg-[#F59E0B]' },
  red: { pill: 'bg-destructive/10 text-destructive border-destructive/30', dot: 'bg-destructive' },
  gray: { pill: 'bg-canvas-soft text-text-muted border-hairline', dot: 'bg-hairline' },
  green: { pill: 'bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/30', dot: 'bg-[#16a34a]' },
} as const;

export default function InformePage() {
  const params = useParams();
  const router = useRouter();
  const report = buildServiceReport(params.id as string);

  if (!report) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-text-muted">Informe no encontrado</p>
      </div>
    );
  }

  const { alert, line, tipoLabel, motivo, afectados, alternativas, timeline, resolved } = report;
  const severity = SEVERITY_META[resolved ? 'green' : alert.severity];

  return (
    <div className="h-dvh overflow-hidden bg-canvas flex flex-col">
      <header className="bg-canvas flex items-center px-4 h-12 w-full shrink-0 z-50 border-b border-hairline-soft shadow-sm">
        <button
          onClick={() => router.back()}
          className="h-12 w-12 flex items-center justify-center text-ink hover:bg-canvas-soft transition-colors rounded-full"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[20px] font-semibold text-ink truncate px-2">
          Informe de servicio
        </h1>
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto w-full flex-1 min-h-0 overflow-y-auto overscroll-contain pb-28">
        <section className="bg-canvas rounded-2xl border border-hairline shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold', severity.pill)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', severity.dot, !resolved && 'animate-pulse')} aria-hidden />
              {resolved ? 'Normalizado' : 'Activo'}
            </span>
            <span className="text-xs font-semibold text-text-muted">{tipoLabel}</span>
          </div>
          <h2 className="text-xl font-bold text-ink leading-snug">{alert.title}</h2>
          <p className="mt-1 text-sm text-text-muted leading-relaxed">{alert.description}</p>
          {alert.since && (
            <p className="mt-2 text-xs text-text-muted">
              {resolved ? 'Normalizado: ' : 'Inicio: '}
              <strong className="tabular-nums text-ink">{alert.since} hs</strong>
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-canvas-soft p-3 border border-hairline-soft">
            <LineBadge shortName={line.shortName} color={line.color} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Línea {line.shortName} — {line.name}</p>
              <p className="text-xs text-text-muted">{line.direction} · cada {line.frequency} min</p>
            </div>
          </div>
        </section>

        <section className="bg-canvas rounded-2xl border border-hairline shadow-sm p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">
            {resolved ? 'Qué pasó' : 'Qué está pasando'}
          </h3>
          <p className="text-sm text-ink leading-relaxed">{motivo}</p>
        </section>

        {afectados.length > 0 && (
          <section className="bg-canvas rounded-2xl border border-hairline shadow-sm p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Tramos afectados
            </h3>
            <ul className="space-y-2">
              {afectados.map(({ stopId, name }) => (
                <li key={stopId} className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-text-muted shrink-0" aria-hidden />
                  <span className="text-sm text-ink">{name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {alternativas.length > 0 && (
          <section className="bg-canvas rounded-2xl border border-hairline shadow-sm p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Alternativas · combiná con
            </h3>
            <ul className="space-y-2.5">
              {alternativas.map((alt, i) => (
                <li key={`${alt.lineId}-${i}`} className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1 text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: alt.color }}
                  >
                    {alt.shortName}
                  </span>
                  <span className="text-sm text-ink">
                    en <strong className="font-semibold">{alt.stopName}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-canvas rounded-2xl border border-hairline shadow-sm p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-3">
            Cronología
          </h3>
          <ol className="space-y-3">
            {timeline.map((item, index) => (
              <li key={item.label} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-0.5" aria-hidden>
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full border-2',
                      index === timeline.length - 1
                        ? 'bg-ink border-ink'
                        : 'border-hairline bg-canvas',
                    )}
                  />
                  {index < timeline.length - 1 && (
                    <span className="my-0.5 h-5 w-0.5 bg-hairline" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold tabular-nums text-ink">{item.hora}</p>
                  <p className="text-sm text-text-muted">{item.label}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push('/mapas')}
            className="min-h-12 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-canvas-soft active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <MapIcon className="w-4 h-4" aria-hidden />
            Ver en el mapa
          </button>
          <button
            onClick={() => router.push('/mapas')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-canvas hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Bus className="w-4 h-4" aria-hidden />
            Ver la línea
          </button>
        </div>
      </main>

      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-40">
        <BottomNav />
      </div>
    </div>
  );
}
