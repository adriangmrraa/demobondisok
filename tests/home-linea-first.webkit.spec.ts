import { devices, expect, test } from "@playwright/test";
import { expectMapPainted, trackErrors } from "./home-helpers";

/**
 * Regression coverage for the iOS/Safari map incident and horizontal diagram
 * panning on the same iPhone-sized WebKit viewport.
 */
test.use({
  ...devices["iPhone 11"],
  browserName: "webkit",
  colorScheme: "dark",
});

for (const path of ["/inicio", "/inicio/b"]) {
  test(`${path}: el canvas del mapa no queda en negro en Safari iPhone`, async ({
    page,
  }) => {
    test.slow();
    const errors = trackErrors(page);
    await page.goto(path);
    await expectMapPainted(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("/inicio: the schematic keeps horizontal panning isolated in WebKit", async ({
  page,
}) => {
  test.slow();
  await page.goto("/inicio");
  await page.getByRole("button", { name: "Ver diagrama lineal." }).click();

  const scroller = page.getByTestId("schematic-scroller");
  await expect(scroller).toBeVisible();
  const state = await scroller.evaluate((element) => {
    const scrollerElement = element as HTMLElement;
    scrollerElement.scrollLeft = scrollerElement.scrollWidth;
    const style = getComputedStyle(scrollerElement);
    return {
      scrollLeft: scrollerElement.scrollLeft,
      touchAction: style.touchAction,
      hasContainClass: scrollerElement.classList.contains(
        "overscroll-x-contain",
      ),
      pageScrollY: window.scrollY,
    };
  });

  expect(state.hasContainClass).toBe(true);
  expect(state.touchAction).toContain("pan-x");
  expect(state.scrollLeft).toBeGreaterThan(0);
  expect(state.pageScrollY).toBe(0);
});
