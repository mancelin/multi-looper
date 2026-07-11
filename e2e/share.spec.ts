import { expect, test, type Page } from "@playwright/test";

// Block YouTube so its IFrame API never patches the placeholder duration —
// keeps YouTube-track assertions deterministic and the suite offline-safe.
async function blockYoutube(page: Page) {
  await page.route(/youtube\.com|ytimg\.com|youtube-nocookie/, (r) => r.abort());
}

const VIDEO = "dQw4w9WgXcQ";

test("opening a share link imports the YouTube track with the shared loop", async ({ page }) => {
  await blockYoutube(page);
  await page.goto(`/?share=${VIDEO}&a=12.5&b=34.25&name=Solo&title=My%20Song`);

  await expect(page.getByText("My Song").first()).toBeVisible();
  await expect(page.getByTitle("Rename loop")).toHaveValue("Solo");
  await expect(page.getByTestId("loop-a")).toHaveValue("0:12.500");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:34.250");
  // consumed share params are dropped from the URL
  await expect(page).toHaveURL(/\/1$/);
});

test("share link for a track already in the library adds the loop instead of a duplicate track", async ({
  page,
}) => {
  await blockYoutube(page);
  await page.goto(`/?share=${VIDEO}&a=10&b=20&name=First`);
  await expect(page.getByTitle("Rename loop")).toHaveValue("First");

  await page.goto(`/?share=${VIDEO}&a=30&b=40&name=Second`);
  await expect(page.getByText("2 loops")).toBeVisible();
  await expect(page.getByTitle("Rename loop").nth(1)).toHaveValue("Second");
  // still a single library entry (count badge next to the LIBRARY header)
  await expect(page.getByText("LIBRARY").locator("xpath=following-sibling::span")).toHaveText("1");
});

test("invalid share link (loop end before start) is ignored", async ({ page }) => {
  await blockYoutube(page);
  await page.goto(`/?share=${VIDEO}&a=30&b=20`);
  await expect(
    page.getByRole("heading", { name: "Loop anything" }),
  ).toBeVisible();
});

test("share button copies a link that encodes the active loop", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await blockYoutube(page);
  await page.goto("/");
  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill(`https://www.youtube.com/watch?v=${VIDEO}`);
  await url.press("Enter");
  await expect(page.getByText("YouTube loop").first()).toBeVisible();

  await page.getByTitle("Copy a share link for the active loop").click();
  await expect(page.getByTestId("toast")).toContainText("Share link copied");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const parsed = new URL(copied);
  expect(parsed.searchParams.get("share")).toBe(VIDEO);
  expect(parsed.searchParams.get("a")).toBe("0");
  expect(parsed.searchParams.get("b")).toBe("210"); // placeholder full-track loop
});
