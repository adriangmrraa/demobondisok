import Link from 'next/link';
import { ChevronRight, Map as MapIcon } from 'lucide-react';

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
      className="home-cta group flex min-h-[68px] items-center gap-3 rounded-3xl px-3.5 text-white transition-transform duration-150 active:scale-[0.98]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]">
        <MapIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-tight">Ver mapa</span>
        <span className="block text-xs text-white/80">Seguí la línea {lineNumber} en el mapa en vivo</span>
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors group-hover:bg-white/25">
        <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
