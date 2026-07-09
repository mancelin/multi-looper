import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "./wav";

const PB_URL = "http://127.0.0.1:8090";

async function pbAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

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

test("sign out wipes localStorage and IndexedDB and returns to the empty state", async ({
  page,
}) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  await page.goto("/");
  await page.setInputFiles('input[type="file"]', {
    name: "wipe.wav",
    mimeType: "audio/wav",
    buffer: makeWav(3),
  });
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");

  // guest data persisted before sign-in
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("multilooper_guest_lib")))
    .not.toBeNull();
  await expect.poll(() => mediaCount(page)).toBeGreaterThan(0);

  // sign up a fresh account (openAuth starts in signup mode)
  const email = `wipe${Date.now()}@example.com`;
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  // import the guest track so the account library is non-empty
  await page.getByRole("button", { name: /Import/ }).click();
  await expect(page.getByText("SYNCED")).toBeVisible();

  // sign out
  await page.getByText("SYNCED").click();
  await page.getByRole("button", { name: "Sign out" }).click();

  // app is back to the pristine empty state, signed out
  await expect(
    page.getByRole("heading", { name: "Loop anything. Master every bar." }),
  ).toBeVisible();
  await expect(page.getByTitle("Sign in")).toBeVisible();

  // storage wiped
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("multilooper_guest_lib")))
    .toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("multilooper_image_heights")),
  ).toBeNull();
  await expect.poll(() => mediaCount(page)).toBe(0);

  // reload: still a fresh app, nothing restored
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Loop anything. Master every bar." }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("multilooper_guest_lib"))).toBeNull();

  // the wipe is local-only — signing back in restores the synced track
  await page.getByTitle("Sign in").click();
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click(); // toggle to signin mode
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click(); // modal submit
  await expect(page.getByText("SYNCED")).toBeVisible();
  await expect(page.getByText("wipe").first()).toBeVisible(); // track title from PB
});
