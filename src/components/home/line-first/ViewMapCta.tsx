import Link from 'next/link';
import { Bus, ChevronRight } from 'lucide-react';

interface ViewMapCtaProps {
  href: string;
  lineNumber: string;
}

/** CTA "Ver mapa" de la variante A: abre /mapas con la línea y la parada elegidas. */
export function ViewMapCta({ href, lineNumber }: ViewMapCtaProps) {
  return (
    <Link
      href={href}
      aria-label={`Ver la línea ${lineNumber} en el mapa en vivo`}
      className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-electric-blue/40 bg-electric-blue px-3 text-white shadow-[0_10px_28px_-10px_rgba(0,102,255,0.7)] transition-all active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Bus className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">Ver mapa</span>
        <span className="block text-xs text-white/80">Línea {lineNumber} en vivo</span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </span>
    </Link>
  );
}
