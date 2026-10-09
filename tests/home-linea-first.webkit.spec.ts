import { devices, expect, test } from '@playwright/test';
import { expectMapPainted, trackErrors } from './home-helpers';

/**
 * Regresión del incidente iOS (docs/INCIDENTE-MAPA-iOS-SAFARI.md) sobre el
 * Inicio: WebKit real emulando iPhone 11 en modo oscuro, como el teléfono del cliente.
 */
test.use({ ...devices['iPhone 11'], browserName: 'webkit', colorScheme: 'dark' });

for (const path of ['/inicio', '/inicio/b']) {
  test(`${path}: el canvas del mapa no queda en negro en Safari iPhone`, async ({ page }) => {
    test.slow();
    const errors = trackErrors(page);
    await page.goto(path);
    await expectMapPainted(page);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
