import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type Coord = [number, number];

type Dataset = {
  lineas: Array<{
    id: string;
    ramales: Array<{ id: string; recorridos: Array<{ coordenadas: Coord[] }> }>;
  }>;
};

// El encuadre de /mapas sale del mismo dataset crudo que carga la app
// (src/data/routes.json vía amba-data). Lo leemos para calcular el extent
// esperado de cada línea/ramal sin duplicar coordenadas a mano.
const DATASET = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src/data/routes.json'), 'utf8'),
) as Dataset;

/** Centro del bounding box de los recorridos de una línea (o un ramal puntual). */
function extentMidpoint(lineaId: string, ramalId?: string): { mid: Coord; span: number } {
  const linea = DATASET.lineas.find((l) => l.id === lineaId);
  if (!linea) throw new Error(`línea ${lineaId} inexistente en routes.json`);
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ramal of linea.ramales) {
    if (ramalId && ramal.id !== ramalId) continue;
    for (const rec of ramal.recorridos) {
      for (const [lng, lat] of rec.coordenadas) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return {
    mid: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    span: Math.max(maxLng - minLng, maxLat - minLat),
  };
}

type MapHandle = {
  __RUTABA_MAP?: {
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
  };
};

/** Centro actual del mapa MapLibre, leído del handle de consola del demo. */
async function mapCenter(page: Page): Promise<Coord> {
  return page.evaluate(() => {
    const map = (window as unknown as MapHandle).__RUTABA_MAP;
    if (!map) throw new Error('todavía no hay instancia de mapa');
    const c = map.getCenter();
    return [c.lng, c.lat] as [number, number];
  });
}

async function mapZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (window as unknown as MapHandle).__RUTABA_MAP;
    if (!map) throw new Error('todavía no hay instancia de mapa');
    return map.getZoom();
  });
}

function degDistance(a: Coord, b: Coord): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Tolerancia al centrado de línea: 25% del extent + 2 km aprox (padding asimétrico de la UI). */
function tolerance(span: number): number {
  return span * 0.25 + 0.02;
}

/**
 * Tolerancia al centrado de ramal, más estricta: el encuadre del ramal debe
 * quedar bien centrado (10% del extent + ~1 km). El mecanismo viejo
 * (`applyHighlight`, padding 90/210) dejaba el centro ~20% corrido del
 * centroide del ramal; el foco por `focusRequest` (padding 60/100) lo centra.
 */
function ramalTolerance(span: number): number {
  return span * 0.1 + 0.01;
}

/** El zoom del encuadre nunca debe superar el techo 16.5 (con holgura de float). */
const LINE_FOCUS_MAX_ZOOM = 16.5;

async function waitForMap(page: Page) {
  await page.waitForFunction(
    () => Boolean((window as unknown as MapHandle).__RUTABA_MAP),
    null,
    { timeout: 45_000 },
  );
}

async function openLineRail(page: Page) {
  await page.getByRole('button', { name: /ver lista de líneas disponibles/i }).click();
}

const viewports = [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
  test.describe(`Mapas — encuadre por línea y ramal (${name})`, () => {
    test.use({ viewport });

    test('al entrar encuadra el recorrido inicial (línea 195)', async ({ page }) => {
      test.slow();
      await page.goto('/mapas');
      await waitForMap(page);

      const { mid, span } = extentMidpoint('line-195');
      await expect
        .poll(async () => degDistance(await mapCenter(page), mid), { timeout: 15_000 })
        .toBeLessThan(tolerance(span));
    });

    test('elegir una línea encuadra su recorrido y deja el centro junto a su centroide', async ({ page }) => {
      test.slow();
      await page.goto('/mapas');
      await waitForMap(page);

      await openLineRail(page);
      await page.getByRole('button', { name: 'Línea 65' }).click();

      const { mid, span } = extentMidpoint('line-65');
      await expect
        .poll(async () => degDistance(await mapCenter(page), mid), { timeout: 15_000 })
        .toBeLessThan(tolerance(span));
      // El techo de zoom evita que una línea corta entre en sobre-zoom.
      expect(await mapZoom(page)).toBeLessThanOrEqual(LINE_FOCUS_MAX_ZOOM + 0.1);
    });

    test('cambiar de ramal re-encuadra la cámara al recorrido de ese ramal', async ({ page }) => {
      test.slow();
      await page.goto('/mapas');
      await waitForMap(page);

      await openLineRail(page);
      await page.getByRole('button', { name: 'Línea 194' }).click();

      // Ramal A (Zárate, al norte/noreste) y ramal B (Escobar, más cerca de
      // CABA): extents bien desplazados, así el re-encuadre es medible.
      await page.getByRole('button', { name: /^A: Once/ }).click();
      const a = extentMidpoint('line-194', 'ramal-194-a');
      await expect
        .poll(async () => degDistance(await mapCenter(page), a.mid), { timeout: 15_000 })
        .toBeLessThan(ramalTolerance(a.span));

      await page.getByRole('button', { name: /^B: Once/ }).click();
      const b = extentMidpoint('line-194', 'ramal-194-b');
      await expect
        .poll(async () => degDistance(await mapCenter(page), b.mid), { timeout: 15_000 })
        .toBeLessThan(ramalTolerance(b.span));

      // La cámara abandonó el centroide del ramal anterior: hubo re-encuadre real.
      expect(degDistance(await mapCenter(page), a.mid)).toBeGreaterThan(0.05);
    });
  });
}
