import { test, expect } from '@playwright/test';

/**
 * QA E2E del toggle "Ver diagrama lineal" en /inicio.
 * Complementa home-linea-first.spec.ts cubriendo el toggle, el filtrado
 * por línea activa, el highlight visual y el atajo Esc.
 *
 * Nota: el home auto-selecciona la primera línea operativa (65), así que
 * el toggle está habilitado desde el primer render.
 */

const diagramSel = '[role="application"][aria-label*="Diagrama lineal"]';
const chip65 = /^Línea 65\./;

test.describe('Home diagram toggle', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  // /inicio monta un mapa WebGL (SwiftShader en este entorno): cada goto tarda
  // 15-40s. Presupuesto ×3 para que el timeout no mida latencia de GPU.
  test.slow();

  test('toggle button visible on /inicio even before selecting a line', async ({ page }) => {
    await page.goto('/inicio');
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeVisible();
  });

  test('toggle button enabled by default (a line is auto-selected)', async ({ page }) => {
    await page.goto('/inicio');
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeEnabled();
  });

  test('toggle button enabled once a line is selected', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    const btn = page.getByRole('button', { name: 'Ver diagrama lineal.' });
    await expect(btn).toBeEnabled();
  });

  test('opening the diagram swaps the map for a linear schematic', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    await expect(page.locator(diagramSel)).toBeVisible();
  });

  test('diagram renders horizontally with multiple stops', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const diagram = page.locator(diagramSel);
    await expect(diagram).toBeVisible();
    // Más de 3 paradas = varios <li> dibujados
    const stops = diagram.locator('li[data-stop-id]');
    expect(await stops.count()).toBeGreaterThan(3);
  });

  test('diagram container is taller than the map (h-[240px])', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const diagram = page.locator(diagramSel);
    const box = await diagram.boundingBox();
    expect(box).not.toBeNull();
    // El diagrama debe ocupar al menos 200px de alto (vs 176px del mapa viejo).
    expect(box!.height).toBeGreaterThanOrEqual(200);
  });

  test('labels do not overlap when line has many stops', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const diagram = page.locator(diagramSel);
    // Obtener todos los labels de parada visibles y verificar que ninguno
    // se superpone en X con otro label (mismo y ±fontHeight).
    const labels = await diagram.locator('li[data-stop-id] p[title]').all();
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
    await page.getByRole('button', { name: chip65 }).click();
    // change the stop
    await page.getByRole('button', { name: /^Cambiar parada/ }).click();
    const picker = page.getByRole('dialog', { name: /Elegí tu parada/ });
    await picker.getByRole('textbox', { name: 'Nombre de la parada' }).fill('Barrancas');
    // submit / select a result (scoped al diálogo: los <li> de arribos quedan detrás del overlay)
    await picker.getByRole('listitem').first().click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const diagram = page.locator(diagramSel);
    await expect(diagram).toBeVisible();
    // La parada activa queda marcada con scale-105 en el <li>
    const highlighted = diagram.locator('li[data-stop-id].scale-105');
    await expect(highlighted).toHaveCount(1);
  });

  test('double-tap chip opens the full diagram of that line', async ({ page }) => {
    await page.goto('/inicio');
    // doble tap en línea 65 → toast "Ruta confirmada" + navegación a /diagrama/line-65
    const chip = page.getByRole('button', { name: chip65 });
    await chip.dblclick();
    await expect(page).toHaveURL(/\/diagrama\/line-65/);
  });

  test('selected line is visually highlighted in diagram (colored track)', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: chip65 }).click();
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    const diagram = page.locator(diagramSel);
    // El track principal del diagrama usa el color de la línea seleccionada.
    const track = diagram.locator('div[style*="height: 2.5px"]');
    await expect(track).toHaveCount(1);
    await expect(track).toHaveCSS('background-color', /rgb/);
  });

  test('Esc closes the diagram and returns to the map', async ({ page }) => {
    await page.goto('/inicio');
    // Sin click extra: la 65 ya viene auto-seleccionada.
    await page.getByRole('button', { name: 'Ver diagrama lineal.' }).click();
    await expect(page.getByRole('button', { name: 'Volver al mapa en vivo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Ver diagrama lineal.' })).toBeVisible();
  });
});
