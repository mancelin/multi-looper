import { expect, test, type Page } from "@playwright/test";

// Block TIDAL so the open API / auth never respond — keeps TIDAL-track
// assertions deterministic and the suite offline-safe.
async function blockTidal(page: Page) {
  await page.route(/tidal\.com/, (r) => r.abort());
}

// The OAuth redirect can't run offline; flip the connected flag through the
// dev-only hook Home installs (see Home.tsx).
async function setTidalConnected(page: Page, v: boolean) {
  await page.waitForFunction(
    () => !!(window as unknown as { __setTidalConnected?: unknown }).__setTidalConnected,
  );
  await page.evaluate(
    (val) =>
      (
        window as unknown as { __setTidalConnected: (v: boolean) => void }
      ).__setTidalConnected(val),
    v,
  );
}

test("link paste stays locked behind the TIDAL login button", async ({ page }) => {
  await blockTidal(page);
  await page.goto("/");
  // empty-state card and topbar only offer the login button
  await expect(page.getByRole("button", { name: "Connect TIDAL" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("tidal.com/track/…")).toHaveCount(0);
  await expect(page.getByPlaceholder("Paste a TIDAL link…")).toHaveCount(0);

  // connecting unlocks the paste inputs
  await setTidalConnected(page, true);
  await expect(page.getByPlaceholder("tidal.com/track/…")).toBeVisible();
  await expect(page.getByPlaceholder("Paste a TIDAL link…")).toBeVisible();
});

test("adding a TIDAL link creates a track with a full-track loop", async ({ page }) => {
  await blockTidal(page);
  await page.goto("/");
  await setTidalConnected(page, true);

  const url = page.getByPlaceholder("tidal.com/track/…").first();
  await url.fill("https://tidal.com/browse/track/430665632");
  await url.press("Enter");

  await expect(page.getByText("TIDAL loop").first()).toBeVisible();
  await expect(page.getByText("TIDAL", { exact: true })).toBeVisible(); // source badge
  // placeholder duration is 210s; loop must span 0 → end
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000");
});

test("topbar TIDAL input adds a track once connected", async ({ page }) => {
  await blockTidal(page);
  await page.goto("/");
  await setTidalConnected(page, true);
  const url = page.getByPlaceholder("Paste a TIDAL link…");
  await url.fill("https://listen.tidal.com/track/12345678?u");
  await url.press("Enter");
  await expect(page.getByText("TIDAL loop").first()).toBeVisible();
});

test("TIDAL modal rejects a non-TIDAL link", async ({ page }) => {
  await blockTidal(page);
  await page.setViewportSize({ width: 800, height: 700 }); // below the inline-input breakpoint
  await page.goto("/");
  await setTidalConnected(page, true);
  await page.getByTitle("Add a TIDAL link").click();
  const input = page.getByPlaceholder("tidal.com/track/…").last();
  await input.fill("https://example.com/track/abc");
  await input.press("Enter");
  await expect(page.getByText("That doesn't look like a TIDAL track link.")).toBeVisible();
});

test("playing a TIDAL track without a connected account prompts to connect", async ({ page }) => {
  await blockTidal(page);
  await page.goto("/");
  // add a track while connected, then drop the connection (e.g. next visit)
  await setTidalConnected(page, true);
  const url = page.getByPlaceholder("tidal.com/track/…").first();
  await url.fill("https://tidal.com/track/430665632");
  await url.press("Enter");
  await expect(page.getByText("TIDAL loop").first()).toBeVisible();
  await setTidalConnected(page, false);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  // playback refuses with a toast and the connect modal, and the transport
  // flips back to paused
  await expect(page.getByTestId("toast")).toContainText(/TIDAL/);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect TIDAL" })).toBeVisible();
});
