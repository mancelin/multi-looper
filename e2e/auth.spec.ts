import { expect, test } from "@playwright/test";

const PB_URL = "http://127.0.0.1:8090";

async function pbAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

test("auth modal offers Google sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("sign-up sends a verification email and confirms it with a toast", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  const email = `verify${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page.getByText(`Verification email sent to ${email}.`)).toBeVisible();
  await expect(page.getByText("SYNCED")).toBeVisible();
});
