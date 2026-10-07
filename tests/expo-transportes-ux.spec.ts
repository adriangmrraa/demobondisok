import { expect, test } from '@playwright/test';

const journeyUrl =
  '/viaje?trip=1&origen=Parque%20Centenario&origenLat=-34.609&origenLng=-58.435&origenParada=stop-65-05&paradaSubida=stop-65-05&destino=Barrancas%20de%20Belgrano';

test('Home offers the four accessible discovery flows', async ({ page }) => {
  await page.goto('/inicio');

  const line = page.getByRole('button', { name: /buscar línea/i });
  await expect(line).toBeVisible();
  await expect(page.getByRole('button', { name: /paradas cerca/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /a dónde vas/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /explorar mapa/i })).toBeVisible();

  await line.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /buscar por línea/i })).toBeVisible();
  await page.getByRole('textbox', { name: /número o nombre de línea/i }).fill('65');
  await expect(page.getByText('Línea 65', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /cerrar búsqueda de línea/i }).click();

  await page.getByRole('button', { name: /paradas cerca/i }).click();
  await expect(page.getByRole('dialog', { name: /usamos tu ubicación/i })).toBeVisible();
  await page.getByRole('button', { name: /usar ubicación real/i }).click();
  await expect(page.getByText(/no autorizaste tu ubicación/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /usar ubicación demo/i })).toBeVisible();

  await page.getByRole('button', { name: /cerrar ubicación/i }).click();
  await page.getByRole('button', { name: /a dónde vas/i }).click();
  await expect(page.getByRole('dialog', { name: /usamos tu ubicación/i })).toBeVisible();

  await page.getByRole('button', { name: /cerrar ubicación/i }).click();
  await page.getByRole('button', { name: /explorar mapa/i }).click();
  await expect(page).toHaveURL(/\/mapas$/);
});

test('Cómo llego completes the trip from Empezar to the alternatives', async ({ page }) => {
  await page.goto('/como-llego');

  await page.getByRole('button', { name: /empezar/i }).click();
  const consent = page.getByRole('dialog', { name: /usamos tu ubicación/i });
  await expect(consent).toBeVisible();
  await consent.getByRole('button', { name: /usar ubicación demo/i }).click();

  const wizard = page.getByRole('dialog', { name: /asistente de viaje/i });
  await expect(wizard).toBeVisible();
  await wizard.getByRole('button', { name: /ver paradas cercanas/i }).click();
  await wizard.getByRole('list').getByRole('button').first().click();

  await wizard.getByRole('textbox', { name: /destino del viaje/i }).fill('Barrancas');
  // Primer resultado del geocoder = "Barrancas de Belgrano" (POI canónico).
  await wizard.getByRole('list').getByRole('button').first().click();

  await expect(page).toHaveURL(/\/viaje\?trip=1/);
  await expect(page.getByRole('region', { name: /alternativas de viaje/i })).toBeVisible();
  await page.getByRole('region', { name: /alternativas de viaje/i }).getByRole('button').first().click();

  await expect(page.getByRole('region', { name: /guía de viaje/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /paso a paso/i })).toBeVisible();
  await expect(page.getByRole('list', { name: /paradas del recorrido/i })).toBeVisible();
  const mapCta = page.getByRole('link', { name: /ver el recorrido en el mapa/i });
  await expect(mapCta).toBeVisible();
  await expect(mapCta).toHaveAttribute('href', /trip=1/);
  await expect(mapCta).toHaveAttribute('href', /opcion=/);
});

test('Cómo llego shows an error when no combination is found', async ({ page }) => {
  await page.goto('/como-llego');

  await page.getByRole('button', { name: /empezar/i }).click();
  await page
    .getByRole('dialog', { name: /usamos tu ubicación/i })
    .getByRole('button', { name: /usar ubicación demo/i })
    .click();

  const wizard = page.getByRole('dialog', { name: /asistente de viaje/i });
  await expect(wizard).toBeVisible();
  await wizard.getByRole('button', { name: /ver paradas cercanas/i }).click();
  await wizard.getByRole('list').getByRole('button').first().click();

  await wizard.getByRole('textbox', { name: /destino del viaje/i }).fill('zzxqwk lugar inexistente');
  await wizard.getByRole('button', { name: /ver cómo llegar/i }).click();

  await expect(wizard.getByRole('alert')).toBeVisible();
  await expect(wizard).toBeVisible();
});

test('A passenger selects a text-first alternative before opening the map', async ({ page }) => {
  await page.goto(journeyUrl);

  await expect(page.getByRole('region', { name: /alternativas de viaje/i })).toBeVisible();
  await expect(page.getByText(/compará las opciones antes de abrir el mapa/i)).toBeVisible();
  await page.getByRole('region', { name: /alternativas de viaje/i }).getByRole('button').first().click();

  await expect(page.getByRole('region', { name: /guía de viaje/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /paso a paso/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /ver el recorrido en el mapa/i })).toBeVisible();
});

test('Map rendering failure keeps the matching text journey available', async ({ page }) => {
  await page.addInitScript(() => {
    const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
      getContext: (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) => unknown;
    };
    const originalGetContext = canvasPrototype.getContext;
    canvasPrototype.getContext = function getContext(contextId, ...args) {
      if (typeof contextId === 'string' && contextId.toLowerCase().startsWith('webgl')) return null;
      return originalGetContext.call(this, contextId, ...args);
    };
  });

  await page.goto(journeyUrl.replace('/viaje', '/mapas'));
  await expect(page.getByRole('alert').filter({ hasText: /el mapa no está disponible/i })).toBeVisible({ timeout: 15_000 });

  const returnToGuide = page.getByRole('link', { name: /volver a la guía del viaje/i });
  await expect(returnToGuide).toBeVisible();
  await returnToGuide.click();
  await expect(page).toHaveURL(/\/viaje\?trip=1/);
  await expect(page.getByRole('region', { name: /alternativas de viaje/i })).toBeVisible();
});
