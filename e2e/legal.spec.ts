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

test("delete-account page explains in-app and email deletion", async ({ page }) => {
  await page.goto("/delete-account");
  await expect(page.getByRole("heading", { name: "Delete your account", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From the app" })).toBeVisible();
  const mail = page.getByRole("link", { name: "multilooper@gmail.com" });
  await expect(mail).toHaveAttribute("href", /^mailto:multilooper@gmail\.com\?subject=/);

  await page.getByRole("link", { name: "privacy policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
});
