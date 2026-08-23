import { expect, test, type Page } from "@playwright/test";

// Chromium's fake capture device feeds MediaRecorder a real (synthetic) audio
// stream, so the whole record → decode → save path runs for real offline.
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-stream"],
  },
  permissions: ["microphone"],
});

/** Records until the modal clock passes `seconds`, then stops and waits for the take. */
async function recordFor(page: Page, seconds: number) {
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("record-stop")).toBeVisible();
  await expect
    .poll(
      async () => {
        const [m, rest] = ((await page.getByTestId("record-time").textContent()) ?? "0:0").split(":");
        return Number(m) * 60 + Number(rest);
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(seconds);
  await page.getByTestId("record-stop").click();
}

test("recording from the mic saves a playable track into the library", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await expect(page.getByTestId("record-modal")).toBeVisible();
  await expect(page.getByTestId("record-save")).toBeDisabled(); // nothing recorded yet

  await recordFor(page, 1);
  await expect(page.getByTestId("record-name")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("record-save")).toBeEnabled();

  // the take must open from silence: a freshly opened capture device puts a
  // click in its first frames and the gain ramp is what keeps it out
  const head = await page.evaluate(async () => {
    const el = document.querySelector("audio") as HTMLAudioElement;
    const ab = await new AudioContext().decodeAudioData(await (await fetch(el.src)).arrayBuffer());
    const ch = ab.getChannelData(0);
    const max = (from: number, to: number) => {
      let m = 0;
      for (let i = from; i < Math.min(to, ch.length); i++) m = Math.max(m, Math.abs(ch[i]));
      return m;
    };
    return { first5ms: max(0, ab.sampleRate * 0.005), whole: max(0, ch.length) };
  });
  expect(head.whole).toBeGreaterThan(0.01); // the fake device really was captured
  expect(head.first5ms).toBeLessThan(0.001);

  await page.getByTestId("record-name").fill("Take one");
  await page.getByTestId("record-save").click();

  await expect(page.getByTestId("record-modal")).toHaveCount(0);
  await expect(page.getByLabel("Track title")).toHaveValue("Take one");
  // the take became a file track with a full-span loop
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  await expect(page.getByTestId("loop-b")).not.toHaveValue("0:00.000");
  await expect(page.locator("video")).toHaveAttribute("src", /blob:/);
});

test("previewing a take plays it back before saving", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await recordFor(page, 1);

  const play = page.getByTestId("record-play");
  await expect(play).toBeVisible({ timeout: 15_000 });
  await play.click();
  await expect(play).toHaveAttribute("aria-label", "Pause preview");
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.currentTime ?? 0))
    .toBeGreaterThan(0);

  await play.click();
  await expect(play).toHaveAttribute("aria-label", "Play preview");
});

test("record again clears the previous take from the view", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await recordFor(page, 1);
  await expect(page.getByTestId("record-again")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("record-again").click();
  await expect(page.getByTestId("record-start")).toBeVisible();
  await expect(page.getByTestId("record-save")).toBeDisabled();
  await expect(page.getByTestId("record-time")).toHaveText("0:00.000");
  // the canvas must be wiped, or the hint text renders on top of the old take
  const painted = await page
    .locator('[data-testid="record-waveform"] canvas')
    .evaluate((cv: HTMLCanvasElement) => {
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
      return n;
    });
  expect(painted).toBe(0);
});

test("cancelling a recording adds no track and releases the mic", async ({ page }) => {
  // track every stream getUserMedia hands out so we can assert it was stopped
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const live = () =>
      (window as unknown as { __recTracks: MediaStreamTrack[] }).__recTracks.filter(
        (t) => t.readyState === "live",
      );
    (window as unknown as { __recTracks: MediaStreamTrack[] }).__recTracks = [];
    (window as unknown as { __liveTracks: () => number }).__liveTracks = () => live().length;
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await real(c);
      (window as unknown as { __recTracks: MediaStreamTrack[] }).__recTracks.push(
        ...s.getTracks(),
      );
      return s;
    };
  });
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("record-stop")).toBeVisible();

  await page.getByTestId("record-cancel").click();
  await expect(page.getByTestId("record-modal")).toHaveCount(0);
  // library stayed empty — the empty state is still the only thing on screen
  await expect(page.getByRole("heading", { name: "Loop anything" })).toBeVisible();
  // the captured track was stopped, so nothing holds the microphone open
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __liveTracks: () => number }).__liveTracks()),
    )
    .toBe(0);
});

test("denied microphone permission shows an actionable error", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  await context.clearPermissions();
  const page = await context.newPage();
  // fake-ui auto-accepts, so deny at the API level instead
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await page.getByTestId("record-start").click();

  await expect(page.getByText("Microphone access was denied.")).toBeVisible();
  await expect(page.getByTestId("record-start")).toBeVisible(); // still retryable
  await context.close();
});
