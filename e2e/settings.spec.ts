import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "./wav";

/** Number of media blobs in the guest IndexedDB store. */
function mediaCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("multilooper", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("media")) {
            db.close();
            resolve(0);
            return;
          }
          const req = db.transaction("media").objectStore("media").count();
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

test("settings modal shows app info, privacy policy and terms of service", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("Settings").click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // guests get no account management entries
  await expect(page.getByRole("button", { name: "Delete all data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete account" })).toBeHidden();

  await page.getByRole("button", { name: "App info" }).click();
  await expect(page.getByRole("heading", { name: "App info" })).toBeVisible();
  await expect(page.getByText(/^v\d+\.\d+(\.\d+)?$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "multilooper@gmail.com" })).toBeVisible();
  const author = page.getByRole("link", { name: "Maxime Ancelin" });
  await expect(author).toHaveAttribute("href", "https://maxime-ancelin.com");

  await page.getByTitle("Back").click();
  await page.getByRole("button", { name: "Privacy policy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText("Data stored on your device")).toBeVisible();

  await page.getByTitle("Back").click();
  await page.getByRole("button", { name: "Terms of service" }).click();
  await expect(page.getByRole("heading", { name: "Terms of service" })).toBeVisible();
  await expect(page.getByText("YouTube's Terms of Service.")).toBeVisible();

  await page.getByRole("button", { name: "✕" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeHidden();
});

test("download my data exports the library as JSON", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "exportme.wav",
    mimeType: "audio/wav",
    buffer: makeWav(3),
  });
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");

  await page.getByTitle("Settings").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^multi-looper-data-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const data = JSON.parse(await readFile(path, "utf8"));
  expect(data.account).toBeNull(); // guest
  expect(data.tracks).toHaveLength(1);
  expect(data.tracks[0].title).toBe("exportme");
  expect(data.tracks[0].loops).toHaveLength(1);
  expect(data.tracks[0].url).toBeUndefined(); // object URL stripped

  // exporting must not close the modal or touch the library
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "✕" }).click();
  await expect(page.getByText("exportme").first()).toBeVisible();
});

test("delete all data wipes the guest library after a confirmation", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "wipeme.wav",
    mimeType: "audio/wav",
    buffer: makeWav(3),
  });
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("multilooper_guest_lib")))
    .not.toBeNull();
  await expect.poll(() => mediaCount(page)).toBeGreaterThan(0);

  await page.getByTitle("Settings").click();
  await page.getByRole("button", { name: "Delete all data" }).click();

  // first click only arms the inline confirmation — cancel keeps everything
  await expect(page.getByText("Deletes every track stored on this device.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Deletes every track stored on this device.")).toBeHidden();
  await expect(page.getByText("wipeme").first()).toBeVisible();

  // confirm for real
  await page.getByRole("button", { name: "Delete all data" }).click();
  await page.getByRole("button", { name: "Delete all data" }).last().click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Loop anything. Master every bar." }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("multilooper_guest_lib")))
    .toBeNull();
  await expect.poll(() => mediaCount(page)).toBe(0);

  // reload: still empty, nothing restored
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Loop anything. Master every bar." }),
  ).toBeVisible();
});
