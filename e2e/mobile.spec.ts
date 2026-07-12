import { test, expect } from "@playwright/test";

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("empty-state logo is fully visible on load", async ({ page }) => {
    await page.goto("/");
    const logo = page
      .getByRole("heading", { name: "Loop anything" })
      .locator("xpath=preceding-sibling::div[1]");
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    // The hero is taller than the viewport here; flex centering must not
    // push the logo above the scroll container's top edge.
    const scrollerTop = await page.evaluate(() => {
      const el = document.querySelector("div.overflow-y-auto");
      return el ? el.getBoundingClientRect().top : 0;
    });
    expect(box!.y).toBeGreaterThanOrEqual(scrollerTop);
  });
});
