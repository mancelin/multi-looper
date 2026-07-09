import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "./wav";

// Block YouTube so its IFrame API never patches the placeholder duration —
// keeps YouTube-track assertions deterministic and the suite offline-safe.
async function blockYoutube(page: Page) {
  await page.route(/youtube\.com|ytimg\.com|youtube-nocookie/, (r) => r.abort());
}

async function uploadWav(page: Page, seconds: number, name = "sample.wav") {
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: "audio/wav",
    buffer: makeWav(seconds),
  });
}

test("empty state renders with both ingest paths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Loop anything. Master every bar." })).toBeVisible();
  await expect(page.getByPlaceholder("youtube.com/watch?v=…")).toBeVisible();
  await expect(page.getByText("Choose files")).toBeVisible();
});

test("adding a YouTube link creates a track with a full-track loop", async ({ page }) => {
  await blockYoutube(page);
  await page.goto("/");
  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");

  await expect(page.getByText("YouTube loop").first()).toBeVisible();
  // placeholder duration is 210s; loop must span 0 → end
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000");
});

test("uploading an audio file decodes duration and spans the loop across it", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  await expect(page.getByText("sample").first()).toBeVisible();
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await expect(page.getByTestId("loop-len")).toHaveText("0:03.000");
});

test("file track media survives reload and still plays", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");

  // media blob comes back from IndexedDB — the track plays without re-upload
  await page.reload();
  await expect(page.getByText("sample").first()).toBeVisible();
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("time")).not.toHaveText("0:00.000", { timeout: 5000 });
  await page.getByRole("button", { name: "Pause" }).click();
});

test("IndexedDB failure while saving media surfaces as a toast", async ({ page }) => {
  await page.addInitScript(() => {
    const broken = {
      open: () => {
        throw new Error("quota exceeded");
      },
    };
    Object.defineProperty(window, "indexedDB", { get: () => broken, configurable: true });
  });
  await page.goto("/");
  await uploadWav(page, 3);

  // the write and the prune both fail -> one toast each (deduped by message)
  const toast = page.getByTestId("toast").filter({ hasText: "Saving track media failed" });
  await expect(toast).toContainText("quota exceeded");

  await toast.getByTitle("Dismiss").click();
  await expect(toast).toHaveCount(0);
});

test("play advances the time readout", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  await expect(page.getByTestId("time")).toHaveText("0:00.000");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByTestId("time")).not.toHaveText("0:00.000", { timeout: 5000 });
  await page.getByRole("button", { name: "Pause" }).click();
});

test("editing loop start via the trim field updates loop length", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  const a = page.getByTestId("loop-a");
  await a.fill("0:01.000");
  await a.press("Enter");
  await expect(a).toHaveValue("0:01.000");
  await expect(page.getByTestId("loop-len")).toHaveText("0:02.000");
});

test("clicking another loop chip selects it", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode
  await page.locator("body").press("n"); // adds Loop 2 (2s long) and selects it

  await expect(page.getByTestId("loop-len")).toHaveText("0:02.000");
  // click lands on the chip; the name input is click-through while inactive
  await page.getByTitle("Rename loop").first().locator("..").click(); // loops sorted by start; Loop 1 first
  await expect(page.getByTestId("loop-len")).toHaveText("0:03.000");
});

test.describe("mobile (360px)", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("drawer sidebar, no horizontal overflow, playback works", async ({ page }) => {
    await page.goto("/");
    await uploadWav(page, 3);
    await expect(page.getByTitle("Rename loop")).toHaveCount(1);

    // narrow starts with the library closed; toggle opens it as a drawer
    await expect(page.getByPlaceholder("Search loops & tags")).toBeHidden();
    await page.getByTitle("Toggle library").click();
    await expect(page.getByPlaceholder("Search loops & tags")).toBeVisible();
    // picking a track closes the drawer
    await page.getByText("sample").first().click();
    await expect(page.getByPlaceholder("Search loops & tags")).toBeHidden();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector("main");
      return Math.max(
        doc.scrollWidth - doc.clientWidth,
        main ? main.scrollWidth - main.clientWidth : 0,
      );
    });
    expect(overflow).toBe(0);

    // exact — otherwise "Add a loop at the playhead (N)" also matches
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByTestId("time")).not.toHaveText("0:00.000", { timeout: 5000 });
  });

  test("YouTube link is added through a modal", async ({ page }) => {
    await blockYoutube(page);
    await page.goto("/");

    // inline URL field is hidden on small screens; icon button opens a modal
    await expect(page.getByPlaceholder("Paste a YouTube link…")).toBeHidden();
    await page.getByTitle("Add a YouTube link").click();

    const input = page.getByPlaceholder("youtube.com/watch?v=…").last(); // modal's, not empty-state's
    await input.fill("not a link");
    await input.press("Enter");
    await expect(page.getByText("That doesn't look like a YouTube link.")).toBeVisible();

    await input.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await input.press("Enter");
    await expect(page.getByText("Add a YouTube link", { exact: true })).toBeHidden(); // modal closed
    await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000");
  });
});

test("removing the last track returns to the empty state", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.getByTitle("Remove", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Loop anything. Master every bar." }),
  ).toBeVisible();
});

// 1x1 red PNG, base64
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("dropping an image onto a file track shows it and survives reload", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], "cover.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector("main")!
      .dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, TINY_PNG);

  await expect(page.getByTestId("track-image")).toBeVisible();

  // image is a data URL, so it survives the guest localStorage round-trip
  await page.reload();
  await expect(page.getByTestId("track-image")).toBeVisible();

  // remove button clears it
  await page.getByTitle("Remove image").click();
  await expect(page.getByTestId("track-image")).toHaveCount(0);
});

test("pasting an image sets the cover on a file track", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], "cover.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector("main")!
      .dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, TINY_PNG);

  await expect(page.getByTestId("track-image")).toBeVisible();
});

test("cover image resizes via the grip, persists, and resets on window resize", async ({
  page,
}) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], "cover.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    document
      .querySelector("main")!
      .dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, TINY_PNG);

  const img = page.getByTestId("track-image");
  await expect(img).toBeVisible();
  const fitted = (await img.boundingBox())!.height;

  // drag the grip 100px up → image gets ~100px shorter, aspect kept
  await img.hover(); // reveal the grip
  const gb = (await page.getByTestId("image-resize-grip").boundingBox())!;
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2 - 100, { steps: 5 });
  await page.mouse.up();
  const resized = (await img.boundingBox())!;
  expect(resized.height).toBeLessThan(fitted - 50);
  expect(Math.abs(resized.width - resized.height)).toBeLessThan(2); // 1x1 png stays square

  // chosen size survives reload while the window size is unchanged
  await page.reload();
  await expect(img).toBeVisible();
  expect(Math.abs((await img.boundingBox())!.height - resized.height)).toBeLessThan(2);

  // a window resize resets the image back to auto-fit and forgets the size
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.width, height: vp.height + 200 });
  await expect
    .poll(async () => (await img.boundingBox())!.height)
    .toBeGreaterThan(resized.height + 20);
  expect(await page.evaluate(() => localStorage.getItem("multilooper_image_heights"))).toBeNull();
});

test("keyboard shortcut N adds a second loop", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  await expect(page.getByTitle("Rename loop")).toHaveCount(1);
  await page.locator("body").press("n");
  await expect(page.getByTitle("Rename loop")).toHaveCount(2);
});
