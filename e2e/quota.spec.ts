import { expect, type Page, test } from "@playwright/test";
import { e2eEmail, pbAvailable, setPremium, signIn, userMediaSize, verifyUser } from "./pb";
import { makeWav } from "./wav";

/** Signs up a fresh verified account and signs it in. */
async function signUpAndIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(
    page.getByText(`Verification email sent to ${email}. Verify, then sign in.`),
  ).toBeVisible();
  verifyUser(email);
  await signIn(page, email, "password123");
  await expect(page.getByText("SYNCED")).toBeVisible();
}

test("uploads stop syncing once the 20 MB account quota is hit", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");
  test.setTimeout(120_000);

  // fresh verified account with an empty library
  const email = e2eEmail("quota");
  await signUpAndIn(page, email);

  // a small file fits the quota and syncs
  await page.setInputFiles('input[type="file"]', {
    name: "tiny-fits.wav",
    mimeType: "audio/wav",
    buffer: makeWav(3),
  });
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");

  // 240 s of 16-bit mono WAV ≈ 21.2 MB — over the quota, refused with a toast
  await page.setInputFiles('input[type="file"]', {
    name: "way-too-big.wav",
    mimeType: "audio/wav",
    buffer: makeWav(240),
  });
  await expect(page.getByText(/Storage limit reached \(20 MB per account\)/)).toBeVisible({
    timeout: 60_000,
  });

  // reload: the synced small track comes back from PB, the refused one is gone
  await page.reload();
  await expect(page.getByText("SYNCED")).toBeVisible();
  await expect(page.getByText("tiny-fits").first()).toBeVisible();
  await expect(page.getByText("way-too-big")).toHaveCount(0);

  // account menu shows the server-side usage (3 s WAV ≈ 0.25 MB → "0.3")
  await page.getByText("SYNCED").click();
  await expect(page.getByTestId("storage-usage")).toContainText("0.3 / 20 MB");
});

test("premium accounts get a 1 GB quota", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");
  test.setTimeout(180_000);

  const email = e2eEmail("premium");
  await signUpAndIn(page, email);
  // admin flips the flag in the PB dashboard — here straight in SQLite
  setPremium(email);

  // 240 s WAV ≈ 20.2 MB — over the free 20 MB limit, fits the premium 1 GB
  await page.setInputFiles('input[type="file"]', {
    name: "premium-big.wav",
    mimeType: "audio/wav",
    buffer: makeWav(240),
  });
  await expect(page.getByTestId("loop-b")).toHaveValue("4:00.000");

  // the upload syncs instead of being refused
  await expect
    .poll(() => userMediaSize(email), { timeout: 90_000 })
    .toBeGreaterThan(20 * 1024 * 1024);
  await expect(page.getByText(/Storage limit reached/)).toHaveCount(0);

  // the account menu picks up the premium quota and server-side usage
  await page.getByText("SYNCED").click();
  await expect(page.getByTestId("storage-usage")).toContainText("20 / 1 GB");

  // survives a reload — the track really lives in PB
  await page.reload();
  await expect(page.getByText("SYNCED")).toBeVisible();
  await expect(page.getByText("premium-big").first()).toBeVisible();
});
