/**
 * Catálogo de líneas del Home "línea primero" (docs/HOME-LINEA-FIRST.md §3).
 *
 * SOLO SERVIDOR: importa `metropol.json` (~240 KB). Los `page.tsx` lo arman y
 * pasan al cliente únicamente el resumen serializable. No importar desde un
 * componente 'use client'.
 *
 * - Operativas: las líneas de `routes.json` (recorridos, paradas y GPS).
 * - Próximamente: el resto del catálogo editorial de Metropol.
 * Al sumar líneas a `routes.json`, pasan a operativas sin tocar el Home.
 */
import metropolData from '@/data/metropol.json';
import { DATASET } from '@/mock/data';
import type { CatalogLine } from './line-first';

interface MetropolCatalogEntry {
  number?: string;
  name?: string;
  recorridos?: { summary?: string }[];
}

export function buildLineCatalog(): CatalogLine[] {
  const operational: CatalogLine[] = DATASET.lineas.map((line) => ({
    id: line.id,
    number: line.numero,
    name: line.nombre,
    color: line.color,
    textColor: line.textColor,
    operational: true,
  }));

  const seen = new Set(operational.map((line) => line.number));
  const upcoming: CatalogLine[] = [];
  for (const entry of metropolData.lines as MetropolCatalogEntry[]) {
    const number = entry.number?.trim();
    if (!number || seen.has(number)) continue;
    seen.add(number);
    upcoming.push({
      id: `catalog-${number}`,
      number,
      name: entry.recorridos?.[0]?.summary ?? entry.name ?? `Línea ${number}`,
      color: null,
      textColor: null,
      operational: false,
    });
  }

  return [...operational, ...upcoming];
}
