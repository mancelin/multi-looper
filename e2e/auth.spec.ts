import { expect, test } from "@playwright/test";
import { e2eEmail, pbAvailable, signIn } from "./pb";

test("auth modal offers Google sign-in", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("sign-up requires the verification email before signing in", async ({ page }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  const email = e2eEmail("verify");
  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  // account created but not signed in - modal closes so the toast is visible
  await expect(
    page.getByText(`Verification email sent to ${email}. Verify, then sign in.`),
  ).toBeVisible();
  await expect(page.getByText("Create your account")).not.toBeVisible();

  // signing in before clicking the verification link is rejected
  await signIn(page, email, "password123");
  await expect(page.getByText("Please verify your email before signing in.")).toBeVisible();
});

test("sign-up explains the account cap and leaves guest mode usable", async ({ page }) => {
  // stand-in for pb_hooks/signup_cap.pb.js refusing the create once MAX_USERS
  // accounts exist, so this runs without PocketBase (and without a full server)
  await page.route("**/api/collections/users/records*", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ status: 400, message: "Sign-ups are closed for now.", data: {} }),
    });
  });

  await page.goto("/");
  await page.getByTitle("Sign in").click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(e2eEmail("capped"));
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(
    page.getByText("Sign-ups are closed for now. Guest mode still works: your library stays on this device."),
  ).toBeVisible();
  // still a guest, modal open, nothing else broken
  await expect(page.getByText("Create your account")).toBeVisible();
  await expect(page.getByTitle("Sign in")).toBeVisible();
});
