import { cn } from '@/lib/utils';
import { LineBadge } from './line-badge';

interface ArrivalCardProps {
  lineName: string;
  lineDirection?: string;
  lineColor?: string;
  etaMin: number;
  live: boolean;
  className?: string;
}

export function ArrivalCard({
  lineName,
  lineDirection,
  lineColor,
  etaMin,
  live,
  className,
}: ArrivalCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between bg-canvas-soft p-2 rounded-lg min-h-[48px] border border-hairline-soft',
        className,
      )}
      role="status"
      aria-label={`Línea ${lineName} llega en ${etaMin} minutos, datos ${live ? 'en vivo' : 'por horario'}`}
    >
      <div className="flex items-center gap-2">
        <LineBadge shortName={lineName} color={lineColor} />
        {lineDirection && (
          <span className="text-base text-ink">{lineDirection}</span>
        )}
      </div>

      <div className="flex flex-col items-end">
        <span
          className={cn(
            'font-bold text-base',
            live ? 'text-[#16a34a]' : 'text-text-muted',
          )}
        >
          {etaMin === 0 ? 'Llega' : `Llega en ${etaMin} min`}
        </span>
        {live ? (
          <span className="text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-1 rounded flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse" />
            En vivo
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">Por horario</span>
        )}
      </div>
    </div>
  );
}
