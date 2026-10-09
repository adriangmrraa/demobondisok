import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectMapPainted, trackErrors } from './home-helpers';

/**
 * QA E2E del Inicio "línea primero" (docs/HOME-LINEA-FIRST.md).
 * Corre contra el build de producción real (webServer de playwright.config.ts)
 * y deriva cada expectativa del dataset real, sin valores inventados.
 */

interface Recorrido { id: string; sentido: 'ida' | 'vuelta'; origen: string; destino: string; paradas: string[] }
interface Ramal { id: string; recorridos: Recorrido[] }
interface Linea { id: string; numero: string; frecuenciaPicoMin: number; ramales: Ramal[] }
interface Dataset { paradas: Record<string, { nombre: string }>; lineas: Linea[] }

const root = join(__dirname, '..');
const dataset = JSON.parse(readFileSync(join(root, 'src/data/routes.json'), 'utf8')) as Dataset;
const metropol = JSON.parse(readFileSync(join(root, 'src/data/metropol.json'), 'utf8')) as { lines: { number: string }[] };

const operationalNumbers = dataset.lineas.map((l) => l.numero);
const upcomingNumber = metropol.lines.map((l) => l.number).find((n) => n && !operationalNumbers.includes(n))!;
const line65 = dataset.lineas.find((l) => l.id === 'line-65')!;
const line194 = dataset.lineas.find((l) => l.id === 'line-194')!;
const ida65 = line65.ramales[0]!.recorridos.find((r) => r.sentido === 'ida')!;
const vuelta65 = line65.ramales[0]!.recorridos.find((r) => r.sentido === 'vuelta')!;
const stopName = (id: string) => dataset.paradas[id]!.nombre;
const shortName = (name: string) => name.split(' / ')[0]!.replace(/\s*\([^)]*\)\s*$/, '').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lineCard = (page: Page) => page.getByRole('region', { name: /^Línea \d+, parada/ });

test.describe('Inicio A (/inicio)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('header unificado: una rosa, saludo con la acción y la fecha del dispositivo', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/inicio');

    const header = page.locator('header').first();
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(/^Hola\s*👋?\s*Elegí tu línea$/);
    await expect(header.locator('svg')).toHaveCount(1);

    const today = await page.evaluate(() =>
      new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
    );
    await expect(header.getByText(today, { exact: false })).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('sin scroll se ve la línea por defecto, su parada y los próximos arribos', async ({ page }) => {
    await page.goto('/inicio');

    await expect(page.getByRole('button', { name: `Línea ${line65.numero}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const card = lineCard(page);
    await expect(card).toContainText(`Línea 65 · ${shortName(stopName('stop-65-05'))}`);
    await expect(card).toContainText(`${ida65.origen} → ${ida65.destino}`);
    await expect(card).toContainText(`Pasa cada ~${line65.frecuenciaPicoMin} min`);
    await expect(card).toContainText(`unos ${Math.round(60 / line65.frecuenciaPicoMin)} en la próxima hora`);

    const arrivals = card.getByRole('listitem');
    await expect(arrivals).toHaveCount(3);
    await expect(arrivals.first()).toContainText(/\d+\s*min|En parada|Arribando/);
    await expect(arrivals.first()).toBeInViewport();
  });

  test('cambiar de línea, de dirección y de parada actualiza la card con datos reales', async ({ page }) => {
    test.slow(); // Muchas interacciones sobre la página con mapa WebGL (SwiftShader en CI).
    await page.goto('/inicio');
    const card = lineCard(page);

    await page.getByRole('button', { name: `Línea ${line194.numero}`, exact: true }).click();
    const ida194 = line194.ramales[0]!.recorridos.find((r) => r.paradas.includes('stop-194-once'))!;
    await expect(card).toContainText(`Línea 194 · ${shortName(stopName('stop-194-once'))}`);
    await expect(card).toContainText(`${ida194.origen} → ${ida194.destino}`);

    await page.getByRole('button', { name: `Línea ${line65.numero}`, exact: true }).click();
    await card.getByRole('button', { name: 'Cambiar dirección' }).click();
    await expect(card).toContainText(`${vuelta65.origen} → ${vuelta65.destino}`);
    const vueltaStop = await card.getByRole('button', { name: /^Cambiar parada/ }).getAttribute('aria-label');
    expect(vuelta65.paradas.map(stopName).some((name) => vueltaStop!.includes(name))).toBe(true);

    await card.getByRole('button', { name: /^Cambiar parada/ }).click();
    const picker = page.getByRole('dialog', { name: /Elegí tu parada/ });
    await expect(picker.getByRole('listitem')).toHaveCount(vuelta65.paradas.length);
    const target = stopName(vuelta65.paradas[6]!);
    await picker.getByRole('textbox', { name: 'Nombre de la parada' }).fill(shortName(target));
    await picker.getByRole('button', { name: new RegExp(escape(target)) }).click();
    await expect(picker).toBeHidden();
    await expect(card).toContainText(shortName(target));
  });

  test('una línea del catálogo sin recorrido avisa y no rompe la selección', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: new RegExp(`^Línea ${upcomingNumber},`) }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `La línea ${upcomingNumber} todavía no tiene recorrido cargado` }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: `Línea ${line65.numero}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('el mapa embebido pinta y abre /mapas con la línea y la parada elegidas', async ({ page }) => {
    test.slow();
    await page.goto('/inicio');
    await expectMapPainted(page);

    const cta = page.getByRole('link', { name: 'Ver la línea 65 en el mapa en vivo', exact: true });
    await expect(cta).toHaveAttribute('href', '/mapas?linea=line-65&parada=stop-65-05');
    await cta.click();
    await expect(page).toHaveURL(/\/mapas\?linea=line-65/);
    await expect(page.getByText('Troncal Constitución – Barrancas de Belgrano')).toBeVisible({ timeout: 15_000 });
  });

  test('un viaje reciente inicia el mismo flujo de viaje de siempre', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('button', { name: /Iniciar viaje en la línea 65 desde Parque Centenario/ }).click();
    await expect(page).toHaveURL(/\/viaje\?trip=1/);
    await expect(page.getByRole('region', { name: /alternativas de viaje/i })).toBeVisible();
  });
});

test.describe('Inicio B (/inicio/b)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('respeta el orden del boceto 2 y despliega todas las líneas', async ({ page }) => {
    test.slow();
    const errors = trackErrors(page);
    await page.goto('/inicio/b');

    const recent = await page.getByRole('heading', { name: 'Tus últimos viajes' }).boundingBox();
    const pick = await page.getByRole('region', { name: 'Elegí una línea' }).boundingBox();
    expect(recent!.y).toBeLessThan(pick!.y);
    await expect(page.getByRole('link', { name: 'Ir a inicio' })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'Ver todas' }).click();
    await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
    const catalogSize = new Set([...operationalNumbers, ...metropol.lines.map((l) => l.number).filter(Boolean)]).size;
    await expect(page.getByRole('button', { name: /^Línea \d+(,|$)/ })).toHaveCount(catalogSize);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('el mapa grande encuadra el recorrido completo', async ({ page }) => {
    test.slow();
    await page.goto('/inicio/b');
    await expectMapPainted(page);
    const zoom = await page.evaluate(() => (window as unknown as { __RUTABA_MAP: { getZoom(): number } }).__RUTABA_MAP.getZoom());
    expect(zoom).toBeGreaterThan(9.5);
  });
});
