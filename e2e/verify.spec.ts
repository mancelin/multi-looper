import { expect, test } from "@playwright/test";
import { e2eEmail, PB_URL, pbAvailable, verificationToken } from "./pb";

// The PB verification email links to `/?verify=<token>` on the app domain
// (set in the users collection's verification template); the app confirms
// the token at boot and opens sign-in.

test("verification link verifies the email and opens sign-in", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  const email = e2eEmail("vlink");
  const res = await fetch(`${PB_URL}/api/collections/users/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", passwordConfirm: "password123" }),
  });
  expect(res.ok).toBe(true);

  await page.goto(`/?verify=${verificationToken(email)}`);
  await expect(page.getByText("Email verified. Sign in to continue.")).toBeVisible();
  await expect(page.getByText("Welcome back")).toBeVisible();
  // token consumed from the URL
  expect(new URL(page.url()).searchParams.get("verify")).toBeNull();

  // the now-verified account passes the `verified = true` auth rule
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByPlaceholder("Password").press("Enter");
  await expect(page.getByText("SYNCED")).toBeVisible();
});

test("invalid verification link shows an error toast", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  await page.goto("/?verify=not-a-real-token");
  await expect(page.getByText("Verification link is invalid or expired.")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("verify")).toBeNull();
});
