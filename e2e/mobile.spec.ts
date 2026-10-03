import { test, expect, type Page } from "@playwright/test";
import { makeWav } from "./wav";

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("empty-state logo is fully visible on load", async ({ page }) => {
    await page.goto("/");
    const logo = page
      .getByRole("heading", { name: "Loop anything" })
      .locator("xpath=preceding-sibling::div[1]");
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    // The hero is taller than the viewport here; flex centering must not
    // push the logo above the scroll container's top edge.
    const scrollerTop = await page.evaluate(() => {
      const el = document.querySelector("div.overflow-y-auto");
      return el ? el.getBoundingClientRect().top : 0;
    });
    expect(box!.y).toBeGreaterThanOrEqual(scrollerTop);
  });
});

const fakeUser = {
  id: "u1",
  collectionId: "_pb_users_auth_",
  collectionName: "users",
  email: "player@example.com",
  verified: true,
  premium: false,
};

/**
 * A signed-in session without PocketBase: a persisted auth store with an
 * unexpired (unsigned) token, and every PB call answered locally. The signed-in
 * account chip is what pushes the phone top bar past its width.
 */
async function fakeSignedIn(page: Page) {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "u1", type: "auth", collectionId: "_pb_users_auth_", exp: 4102444800 })}.sig`;
  await page.addInitScript(
    ([t, r]) =>
      localStorage.setItem(
        "pocketbase_auth",
        JSON.stringify({ token: t, record: r }),
      ),
    [token, fakeUser] as const,
  );
  await page.route(/127\.0\.0\.1:8090\/api\//, (route) => {
    const url = route.request().url();
    if (url.includes("auth-refresh"))
      return route.fulfill({ json: { token, record: fakeUser } });
    if (route.request().method() === "GET" && url.includes("/records"))
      return route.fulfill({
        json: {
          page: 1,
          perPage: 500,
          totalItems: 0,
          totalPages: 0,
          items: [],
        },
      });
    return route.fulfill({
      json: { id: `r${Date.now()}`, collectionName: "tracks" },
    });
  });
}

test.describe("phone top bar with a track open", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("the add button stays visible and clear of the settings button", async ({
    page,
  }) => {
    await fakeSignedIn(page);
    await page.goto("/");
    await expect(page.getByTitle("player@example.com")).toBeVisible();
    await page.setInputFiles('input[type="file"]', {
      name: "phone.wav",
      mimeType: "audio/wav",
      buffer: makeWav(3),
    });
    await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode
    await expect(page.getByTitle("Toggle library")).toBeVisible();

    const add = page.getByTestId("open-add-menu");
    await expect(add).toBeVisible();
    const a = (await add.boundingBox())!;
    const s = (await page.getByTitle("Settings").boundingBox())!;
    expect(a.x + a.width).toBeLessThanOrEqual(s.x);
    expect(s.x + s.width).toBeLessThanOrEqual(360);

    await add.click();
    await expect(page.getByText("Add a track")).toBeVisible();
  });
});
