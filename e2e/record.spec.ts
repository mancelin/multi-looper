import { expect, test, type Page } from "@playwright/test";

// Chromium's fake capture device feeds MediaRecorder a real (synthetic) audio
// stream, so the whole record → decode → save path runs for real offline.
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-capture", "--use-fake-ui-for-media-stream"],
  },
  permissions: ["microphone"],
});

async function clockSeconds(page: Page) {
  const [m, rest] = ((await page.getByTestId("record-time").textContent()) ?? "0:0").split(":");
  return Number(m) * 60 + Number(rest);
}

/** Waits out arming, captures past `seconds`, then stops. */
async function captureFor(page: Page, seconds: number) {
  await expect(page.getByTestId("record-stop")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => clockSeconds(page), { timeout: 15_000 }).toBeGreaterThan(seconds);
  await page.getByTestId("record-stop").click();
}

/** Records until the modal clock passes `seconds`, then stops and waits for the take. */
async function recordFor(page: Page, seconds: number) {
  await page.getByTestId("record-start").click();
  await captureFor(page, seconds);
}

test("the empty state's record card opens the modal", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("empty-record").click();
  await expect(page.getByTestId("record-modal")).toBeVisible();
  await expect(page.getByTestId("record-start")).toBeVisible();
});

test("the waveform stays blank until the take starts", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await expect(page.getByTestId("record-start")).toBeEnabled(); // mic is live
  await page.waitForTimeout(700);

  const painted = () =>
    page.locator('[data-testid="record-waveform"] canvas').evaluate((cv: HTMLCanvasElement) => {
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
      return n;
    });
  // the mic is already open, but nothing may move before the user commits
  expect(await painted()).toBe(0);

  await page.getByTestId("record-start").click();
  await expect(page.getByTestId("record-stop")).toBeVisible();
  await expect.poll(painted, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("recording from the mic saves a playable track into the library", async ({ page }) => {
  await fakeMic(page, [[0, 0.5]]); // steady tone, so head/loop assertions are exact
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await expect(page.getByTestId("record-modal")).toBeVisible();
  await expect(page.getByTestId("record-save")).toBeDisabled(); // nothing recorded yet

  await recordFor(page, 1);
  await expect(page.getByTestId("record-name")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("record-save")).toBeEnabled();

  // the take must ramp in rather than start on a step, or sample zero clicks
  const head = await page.evaluate(async () => {
    const el = document.querySelector("audio") as HTMLAudioElement;
    const ab = await new AudioContext().decodeAudioData(await (await fetch(el.src)).arrayBuffer());
    const ch = ab.getChannelData(0);
    const max = (from: number, to: number) => {
      let m = 0;
      for (let i = from; i < Math.min(to, ch.length); i++) m = Math.max(m, Math.abs(ch[i]));
      return m;
    };
    return { first1ms: max(0, ab.sampleRate * 0.001), whole: max(0, ch.length) };
  });
  expect(head.whole).toBeGreaterThan(0.05); // the mic really was captured
  expect(head.first1ms).toBeLessThan(head.whole * 0.1);

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
  // review-only chrome must go with it, or the old take stays on screen
  await expect(page.getByTestId("record-name")).toHaveCount(0);
  await expect(page.getByTestId("record-play")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
});

/** Replaces the mic with a scripted tone: [seconds, amplitude] steps. */
async function fakeMic(page: Page, steps: [number, number][]) {
  await page.addInitScript((script: [number, number][]) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      await ac.resume();
      const dest = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.value = 440;
      osc.connect(g);
      g.connect(dest);
      for (const [at, amp] of script) g.gain.setValueAtTime(amp, ac.currentTime + at);
      osc.start();
      return dest.stream;
    };
  }, steps);
}

test("a saved take behaves like any local file track", async ({ page }) => {
  // MediaRecorder webm carries no duration header, so the <video> element
  // reports a fraction of the real length; the decoded duration must win or
  // the whole take collapses into a sub-second loop.
  await fakeMic(page, [[0, 0.5]]);
  // Chromium answers Infinity here (already ignored); Firefox answers a small
  // finite number, which is the case that used to win over the decode.
  await page.addInitScript(() => {
    const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration")!;
    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      get(this: HTMLMediaElement) {
        const real = desc.get!.call(this) as number;
        return this.src.startsWith("blob:") && !isFinite(real) ? 1.02 : real;
      },
    });
  });
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await recordFor(page, 3);
  await expect(page.getByTestId("record-name")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("record-save").click();

  // full-span loop over the real length, exactly like an uploaded file
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  const b = Number((await page.getByTestId("loop-b").inputValue()).split(":")[1]);
  expect(b).toBeGreaterThan(2.5);

  // ...and it survives the media element loading, which is what used to clobber it
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(600);
  expect(Number((await page.getByTestId("loop-b").inputValue()).split(":")[1])).toBeGreaterThan(2.5);

  // same source label and accent as a local file — only the tag differs
  await expect(page.getByText("Local file").first()).toBeVisible();
  await expect(page.getByText("REC").first()).toBeVisible();
});

test("noise made when the mic opens is not in the take", async ({ page }) => {
  // Stand in for a Bluetooth headset: a loud beep for the first 250ms the
  // stream is open, then quiet. The stream opens with the modal, and the
  // encoder additionally refuses to start until it has been open MIN_OPEN_MS,
  // so even this click-immediately path must produce a clean file.
  await fakeMic(page, [
    [0, 0.9],
    [0.25, 0],
  ]);
  await page.goto("/");
  await page.getByTestId("open-record").click();
  await recordFor(page, 1);
  await expect(page.getByTestId("record-play")).toBeVisible({ timeout: 15_000 });

  const peak = await page.evaluate(async () => {
    const el = document.querySelector("audio") as HTMLAudioElement;
    const ab = await new AudioContext().decodeAudioData(await (await fetch(el.src)).arrayBuffer());
    const ch = ab.getChannelData(0);
    let m = 0;
    for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
    return m;
  });
  expect(peak).toBeLessThan(0.1); // the 0.9 beep never reached the encoder
});

test("the noise suppression toggle drives the capture constraint", async ({ page }) => {
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as unknown as { __constraints: MediaTrackConstraints[] }).__constraints = [];
    navigator.mediaDevices.getUserMedia = (c) => {
      (window as unknown as { __constraints: MediaTrackConstraints[] }).__constraints.push(
        c?.audio as MediaTrackConstraints,
      );
      return real(c);
    };
  });
  const asked = () =>
    page.evaluate(
      () => (window as unknown as { __constraints: MediaTrackConstraints[] }).__constraints,
    );

  await page.goto("/");
  await page.getByTestId("open-record").click();
  const toggle = page.getByTestId("record-denoise");
  await expect(toggle).toBeChecked(); // on by default

  await recordFor(page, 1);
  await expect(page.getByTestId("record-again")).toBeVisible({ timeout: 15_000 });
  expect((await asked())[0]).toMatchObject({
    noiseSuppression: true,
    // the rest of the speech DSP stays off whatever the toggle says
    echoCancellation: false,
    autoGainControl: false,
  });

  // unchecking it carries through to the next take, and the choice sticks
  // across a close/reopen of the modal
  await page.getByTestId("record-again").click();
  await toggle.uncheck();
  await page.getByTestId("record-cancel").click();
  await page.getByTestId("open-record").click();
  await expect(toggle).not.toBeChecked();

  await recordFor(page, 1);
  await expect(page.getByTestId("record-again")).toBeVisible({ timeout: 15_000 });
  const all = await asked();
  expect(all[all.length - 1]).toMatchObject({ noiseSuppression: false });
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

  // the mic is requested with the modal, so the error shows without clicking
  await expect(page.getByText("Microphone access was denied.")).toBeVisible();
  await expect(page.getByTestId("record-start")).toBeDisabled();
  await context.close();
});
