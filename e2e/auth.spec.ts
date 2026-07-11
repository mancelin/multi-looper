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

  // account created but not signed in — modal closes so the toast is visible
  await expect(
    page.getByText(`Verification email sent to ${email}. Verify, then sign in.`),
  ).toBeVisible();
  await expect(page.getByText("Create your account")).not.toBeVisible();

  // signing in before clicking the verification link is rejected
  await signIn(page, email, "password123");
  await expect(page.getByText("Please verify your email before signing in.")).toBeVisible();
});
