import { expect, test } from "@playwright/test";
import { pbAvailable, verifyUser } from "./pb";
import { makeWav } from "./wav";

test("uploads stop syncing once the 20 MB account quota is hit", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");
  test.setTimeout(120_000);

  // fresh verified account with an empty library
  const email = `quota${Date.now()}@example.com`;
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
  await page.getByPlaceholder("Password").press("Enter");
  await expect(page.getByText("SYNCED")).toBeVisible();

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
});
