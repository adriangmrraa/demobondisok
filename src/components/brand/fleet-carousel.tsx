/**
 * Carrusel de fotos de flota — scroll-snap sin dependencias.
 *
 * Fotos reales de metropol.com.ar. Flechas + contador + barra de progreso.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface FleetPhoto {
  src: string;
  title: string;
  caption: string;
}

interface FleetCarouselProps {
  photos: FleetPhoto[];
}

export function FleetCarousel({ photos }: FleetCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }, [photos.length]);

  const goTo = useCallback((target: number) => {
    const el = trackRef.current;
    if (!el) return;
    setIndex(target);
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  }, []);

  if (photos.length === 0) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Fotos de la flota"
      className="relative overflow-hidden rounded-3xl border border-hairline bg-canvas shadow-lg"
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar motion-safe:scroll-smooth"
      >
        {photos.map((photo, i) => (
          <div
            key={photo.src}
            aria-label={`${i + 1} de ${photos.length}`}
            aria-hidden={i !== index}
            className="relative aspect-[4/3] w-full flex-shrink-0 snap-center sm:aspect-[16/9]"
          >
            <Image
              src={photo.src}
              alt={`${photo.title} — ${photo.caption}`}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover"
              priority={i === 0}
            />
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(16,29,61,0.55)_45%,rgba(16,29,61,0.92)_100%)] p-5 pt-14 text-white">
              <p className="text-base font-extrabold leading-tight">{photo.title}</p>
              <p className="mt-1 text-sm text-white/75 leading-snug">{photo.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-sm font-bold tabular-nums text-ink" aria-live="polite">
          {pad(index + 1)}
          <span className="mx-1.5 text-text-muted">—</span>
          <span className="text-text-muted">{pad(photos.length)}</span>
        </p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-canvas-soft" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[#E30613] transition-all duration-300"
            style={{ width: `${((index + 1) / photos.length) * 100}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-canvas-soft disabled:opacity-35 disabled:hover:bg-canvas"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === photos.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-canvas-soft disabled:opacity-35 disabled:hover:bg-canvas"
            aria-label="Foto siguiente"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
