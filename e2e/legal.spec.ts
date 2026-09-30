import { expect, test } from "@playwright/test";

// Public pages linked from the Play Store listing: they must load standalone,
// without the app shell.

test("privacy policy page loads standalone", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page.getByText("Data stored on your device")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Microphone" })).toBeVisible();
  await expect(page.getByRole("link", { name: "multi-looper.com/delete-account" })).toBeVisible();
});

test("delete-account page explains in-app deletion", async ({ page }) => {
  await page.goto("/delete-account");
  await expect(page.getByRole("heading", { name: "Delete your account", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
  await expect(page.getByText('Tap "Delete account", then confirm.')).toBeVisible();
  // deleting must not require the installed app: the web app has the same button
  await expect(page.getByRole("link", { name: "multi-looper.com", exact: true })).toHaveAttribute(
    "href",
    "https://multi-looper.com",
  );

  // footer links to the other legal pages, not to itself
  const footer = page.getByRole("navigation", { name: "Legal" });
  await expect(footer.getByRole("link", { name: "How to delete account" })).toHaveCount(0);
  await footer.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
});

test("terms of service page loads standalone", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of service", level: 1 })).toBeVisible();
  await expect(page.getByText("YouTube's Terms of Service.")).toBeVisible();
});

test("home screen links to the privacy policy and terms of service", async ({ page }) => {
  await page.goto("/");
  const legal = page.getByRole("navigation", { name: "Legal" });
  await legal.getByRole("link", { name: "Terms of service" }).click();
  await expect(page.getByRole("heading", { name: "Terms of service", level: 1 })).toBeVisible();

  await page.goto("/");
  await legal.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
});
