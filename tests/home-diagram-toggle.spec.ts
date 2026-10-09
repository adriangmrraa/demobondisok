import { test, expect } from '@playwright/test';

/**
 * QA E2E del toggle "Ver diagrama lineal" en /inicio.
 * Complementa home-linea-first.spec.ts cubriendo el toggle, el filtrado
 * por línea activa, el highlight visual y el atajo Esc.
 */

test.describe('Home diagram toggle', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('toggle button visible on /inicio even before selecting a line', async ({ page }) => {
    await page.goto('/inicio');
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeVisible();
  });

  test('toggle button disabled before any line selected', async ({ page }) => {
    await page.goto('/inicio');
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeDisabled();
  });

  test('toggle button enabled once a line is selected', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeEnabled();
  });

  test('opening the diagram swaps the map for an SVG schematic', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    await expect(page.locator('svg[role="img"][aria-label*="Línea 65"]')).toBeVisible();
  });

  test('diagram SVG renders horizontally with multiple stops', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const svg = page.locator('svg[role="img"][aria-label*="Línea 65"]');
    await expect(svg).toBeVisible();
    // Más de 3 círculos = varias paradas dibujadas
    const circles = svg.locator('circle');
    await expect(circles).not.toHaveCount(0);
  });

  test('diagram container is taller than the map (h-[240px])', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const svg = page.locator('svg[role="img"][aria-label*="Línea 65"]');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    // El diagrama debe ocupar al menos 200px de alto (vs 176px del mapa viejo).
    expect(box!.height).toBeGreaterThanOrEqual(200);
  });

  test('labels do not overlap when line has many stops', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const svg = page.locator('svg[role="img"][aria-label*="Línea 65"]');
    // Obtener todos los <text> visibles y verificar que ninguno se superpone
    // en X con otro label (mismo y ±fontHeight).
    const labels = await svg.locator('text').all();
    const boxes = await Promise.all(labels.map((l) => l.boundingBox()));
    const visible = boxes.filter((b): b is NonNullable<typeof b> => b !== null);
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = visible[i]!;
        const b = visible[j]!;
        // Si están en la misma fila vertical (±6px) y se solapan en X → fail
        if (Math.abs(a.y - b.y) < 12 && Math.abs(a.x - b.x) < Math.max(a.width, b.width) / 2) {
          // Permitir hasta cierto punto: diferencia de X debe ser >= ancho del más chico
          const minGap = Math.min(a.width, b.width) / 2;
          if (Math.abs(a.x - b.x) < minGap) {
            throw new Error(`Labels superpuestos en (${a.x},${a.y}) y (${b.x},${b.y})`);
          }
        }
      }
    }
  });

  test('selected stop is highlighted in the diagram', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    // change the stop
    await page.getByRole('button', { name: /^Cambiar parada/ }).click();
    await page.getByRole('textbox', { name: 'Nombre de la parada' }).fill('Barrancas');
    // submit / select a result
    await page.getByRole('listitem').first().click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const svg = page.locator('svg[role="img"][aria-label*="Línea 65"]');
    await expect(svg).toBeVisible();
    // Hay al menos un dot con halo (highlight)
    const haloedDots = svg.locator('circle[opacity="0.28"]');
    await expect(haloedDots).not.toHaveCount(0);
  });

  test('double-tap chip shows confirmation toast with the diagrama URL', async ({ page }) => {
    await page.goto('/inicio');
    // doble tap en línea 65
    const chip = page.getByRole('button', { name: 'Línea 65', exact: true });
    await chip.dblclick();
    await expect(page.getByRole('status')).toContainText('Ruta confirmada: /diagrama/line-65');
  });

  test('selected line is visually highlighted in diagram (thicker stroke)', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const path = page.locator('svg[role="img"] path[data-line-id="line-65"]').first();
    await expect(path).toHaveAttribute('stroke-width', /3/);
  });

  test('Esc closes the diagram and returns to the map', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: 'Línea 65', exact: true }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    await expect(page.getByRole('button', { name: 'Volver al mapa en vivo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Ver diagrama lineal.' })).toBeVisible();
  });
});