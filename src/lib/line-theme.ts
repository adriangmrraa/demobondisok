import rawDataset from '@/data/routes.json';
import type { TransportNetworkDataset } from '@/types/transport';

const dataset = rawDataset as unknown as TransportNetworkDataset;
const colorByLineId = new Map(dataset.lineas.map((line) => [line.id, line.color]));
const colorByRouteKey = new Map<string, string>();

for (const line of dataset.lineas) {
  colorByRouteKey.set(line.id, line.color);
  for (const branch of line.ramales) {
    colorByRouteKey.set(branch.id, line.color);
    for (const route of branch.recorridos) colorByRouteKey.set(route.id, line.color);
  }
}

/** Brand color of a public line. Direction and branch never change this identity. */
export function getLineColor(lineId: string, fallback = '#101D3D'): string {
  return colorByLineId.get(lineId) ?? fallback;
}

/** Resolves a full line, a branch, or a route identifier to its line brand color. */
export function getRouteLineColor(routeKey: string, fallback = '#101D3D'): string {
  return colorByRouteKey.get(routeKey) ?? fallback;
}
