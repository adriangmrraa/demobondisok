import { expect, test, type Page } from "@playwright/test";

const chip65 = /^Línea 65\./;
const chip163 = /^Línea 163\./;
const chip194 = /^Línea 194\./;

async function openDiagram(page: Page) {
  await page.getByRole("button", { name: "Ver diagrama lineal." }).click();
  await expect(page.getByTestId("line-schematic")).toBeVisible();
}

test.describe("Home diagram toggle", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.slow();

  test("the toggle is available for the default selected line", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await expect(
      page.getByRole("button", { name: "Ver diagrama lineal." }),
    ).toBeEnabled();
  });

  test("keeps one 176px slot and does not move the stop card when toggled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/inicio");

    const slot = page.getByTestId("map-diagram-slot");
    const stopCard = page.getByText("Tu parada", { exact: true });
    const mapHeight = await slot.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const mapCardTop = await stopCard.evaluate(
      (element) => element.getBoundingClientRect().top,
    );

    await openDiagram(page);

    const diagramHeight = await slot.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const diagramCardTop = await stopCard.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(mapHeight).toBe(176);
    expect(diagramHeight).toBe(176);
    expect(Math.abs(diagramCardTop - mapCardTop)).toBeLessThan(1);
  });

  test("renders the active stop and opens the existing stop picker from a diagram stop", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await page.getByRole("button", { name: chip65 }).click();
    await openDiagram(page);

    const schematic = page.getByTestId("line-schematic");
    await expect(schematic.locator("li[data-stop-id]")).toHaveCount(9);
    await expect(
      schematic.locator('button[aria-current="location"]'),
    ).toHaveAttribute("aria-current", "location");

    await schematic.locator("li[data-stop-id] button").nth(2).click();
    await expect(
      page.getByRole("dialog", { name: /Elegí tu parada/ }),
    ).toBeVisible();
  });

  test("updates and recenters the schematic after selecting a stop in the picker", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/inicio");
    await openDiagram(page);

    const schematic = page.getByTestId("line-schematic");
    await schematic.locator("li[data-stop-id] button").first().click();
    const dialog = page.getByRole("dialog", { name: /Elegí tu parada/ });
    await dialog
      .getByRole("textbox", { name: "Nombre de la parada" })
      .fill("Barrancas");
    await dialog.getByRole("listitem").first().getByRole("button").click();

    const activeStop = schematic.locator('button[aria-current="location"]');
    await expect(activeStop).toBeVisible();
    const centerDelta = await schematic.evaluate((root) => {
      const scroller = root.querySelector<HTMLElement>(
        '[data-testid="schematic-scroller"]',
      )!;
      const active = root.querySelector<HTMLElement>(
        'button[aria-current="location"]',
      )!;
      const activeRect = active.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      return Math.abs(
        activeRect.left +
          activeRect.width / 2 -
          (scrollerRect.left + scrollerRect.width / 2),
      );
    });
    expect(centerDelta).toBeLessThanOrEqual(16);
  });

  test("uses a full-width continuous track for short and long routes", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await page.getByRole("button", { name: chip163 }).click();
    await openDiagram(page);
    await expect(
      page.getByTestId("line-schematic").locator("li[data-stop-id]"),
    ).toHaveCount(4);

    await page.getByRole("button", { name: "Volver al mapa en vivo" }).click();
    await page.getByRole("button", { name: chip194 }).click();
    await openDiagram(page);

    const schematic = page.getByTestId("line-schematic");
    await expect(schematic.locator("li[data-stop-id]")).toHaveCount(38);
    const dimensions = await schematic.evaluate((root) => {
      const scroller = root.querySelector<HTMLElement>(
        '[data-testid="schematic-scroller"]',
      )!;
      const track = root.querySelector<HTMLElement>(
        '[data-testid="schematic-track"]',
      )!;
      scroller.scrollLeft = scroller.scrollWidth;
      return {
        trackWidth: track.offsetWidth,
        scrollWidth: scroller.scrollWidth,
      };
    });
    expect(
      Math.abs(dimensions.trackWidth - dimensions.scrollWidth),
    ).toBeLessThanOrEqual(1);
  });

  test("is keyboard-operable with a visible focus indicator", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await openDiagram(page);

    const lastStop = page
      .getByTestId("line-schematic")
      .locator("li[data-stop-id] button")
      .last();
    await page.keyboard.press("Shift+Tab");
    await expect(lastStop).toBeFocused();
    const focusStyle = await lastStop.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    );
    expect(focusStyle).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: /Elegí tu parada/ }),
    ).toBeVisible();
  });

  test("Esc returns from the diagram to the map", async ({ page }) => {
    await page.goto("/inicio");
    await openDiagram(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Ver diagrama lineal." }),
    ).toBeVisible();
  });

  test("double-tapping a line chip still opens the full line diagram", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await page.getByRole("button", { name: chip65 }).dblclick();
    await expect(page).toHaveURL(/\/diagrama\/line-65/);
  });
});
