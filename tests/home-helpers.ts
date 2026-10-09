import { expect, type Page } from '@playwright/test';

/** Errores reales de la página (excepciones y console.error), sin el ruido de tiles cancelados. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource|tiles|cartocdn|cancelled/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

/**
 * El canvas WebGL pintó tiles reales. `areTilesLoaded()`/`isStyleLoaded()` no
 * sirven acá: el feed de 1 Hz recarga las fuentes GeoJSON y casi nunca quedan
 * en true. Criterio visual: un canvas negro o del color de fondo comprime a
 * pocos KB; con calles y recorrido supera holgadamente 25 KB.
 */
export async function expectMapPainted(page: Page) {
  const canvas = page.locator('canvas.maplibregl-canvas').first();
  // MapLibre se importa en diferido: en WebKit con workers en paralelo tarda varios segundos.
  await expect(canvas).toBeVisible({ timeout: 45_000 });
  // Screenshot de PÁGINA recortado al canvas: en Playwright-WebKit el element
  // screenshot no compone el canvas WebGL (devuelve 0 bytes aunque el mapa
  // pintó); el screenshot de página sí captura el frame compuesto.
  await expect
    .poll(
      async () => {
        const box = await canvas.boundingBox();
        if (!box) return 0;
        return (await page.screenshot({ clip: box, timeout: 5_000 }).catch(() => Buffer.alloc(0))).byteLength;
      },
      { timeout: 40_000, intervals: [1_000] },
    )
    .toBeGreaterThan(25_000);
}
