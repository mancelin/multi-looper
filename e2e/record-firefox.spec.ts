import { existsSync } from "node:fs";
import { expect, firefox, test } from "@playwright/test";

// Firefox-only regression: its MediaRecorder webm output is unseekable, which
// left the playhead pinned at 0 and made every loop shortcut a no-op. Skipped
// when this machine has no Firefox build, like the PocketBase-backed specs.
const hasFirefox = (() => {
  try {
    return existsSync(firefox.executablePath());
  } catch {
    return false;
  }
})();

test.use({
  browserName: "firefox",
  launchOptions: {
    firefoxUserPrefs: {
      "media.navigator.streams.fake": true,
      "media.navigator.permission.disabled": true,
    },
  },
});

test("a take records into a container Firefox can seek", async ({ page }) => {
  test.skip(!hasFirefox, "no Firefox build installed");
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await page.getByTestId("record-start").click();
  await page.waitForTimeout(4000);
  await page.getByTestId("record-stop").click();
  await expect(page.getByTestId("record-name")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("record-save").click();
  await expect(page.locator("video")).toHaveCount(1);

  // the element must know the length and accept a seek - webm gives neither
  await expect
    .poll(() => page.evaluate(() => document.querySelector("video")!.seekable.length), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  const seeked = await page.evaluate(async () => {
    const v = document.querySelector("video") as HTMLVideoElement;
    v.currentTime = 1.5;
    await new Promise((r) => setTimeout(r, 800));
    return v.currentTime;
  });
  expect(seeked).toBeGreaterThan(1);

  // ...so the A/B shortcuts land where the playhead actually is
  await page.locator("body").press("a");
  await expect(page.getByTestId("loop-a")).toHaveValue(/^0:0[12]\./);

  await page.evaluate(async () => {
    const v = document.querySelector("video") as HTMLVideoElement;
    v.currentTime = 3;
    await new Promise((r) => setTimeout(r, 800));
  });
  await page.locator("body").press("b");
  await expect(page.getByTestId("loop-b")).toHaveValue(/^0:0[23]\./);
});
