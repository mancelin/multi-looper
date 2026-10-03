import { expect, test, type Page } from "@playwright/test";
import { makeWav } from "./wav";

// Block YouTube so its IFrame API never patches the placeholder duration -
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

test("empty state renders every ingest path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Loop anything" })).toBeVisible();
  await expect(page.getByPlaceholder("youtube.com/watch?v=…")).toBeVisible();
  await expect(page.getByText("Choose files")).toBeVisible();
  await expect(page.getByTestId("empty-record")).toBeVisible();
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

// Fake YouTube IFrame API, faithful to the autostart quirks the controller
// must work around: loadVideoById always autostarts, and seekTo on a cued
// video starts playback. Records calls on window.__yt for assertions.
async function fakeYoutubeApi(page: Page) {
  await page.addInitScript(() => {
    type Events = { onReady: () => void; onStateChange: (e: { data: number }) => void };
    const calls: string[] = [];
    class FakePlayer {
      state = -1; // unstarted
      private videoId: string;
      private events: Events;
      constructor(_el: HTMLElement, opts: { videoId: string; events: Events }) {
        this.videoId = opts.videoId;
        this.events = opts.events;
        (window as unknown as { __yt?: { calls: string[]; player: FakePlayer } }).__yt = {
          calls,
          player: this,
        };
        setTimeout(() => {
          this.state = 5; // video cued
          this.events.onReady();
        }, 0);
      }
      private setState(s: number): void {
        this.state = s;
        this.events.onStateChange({ data: s });
      }
      playVideo(): void {
        calls.push("playVideo");
        this.setState(1);
      }
      pauseVideo(): void {
        calls.push("pauseVideo");
        if (this.state === 1) this.setState(2);
      }
      stopVideo(): void {
        calls.push("stopVideo");
        this.state = -1;
      }
      seekTo(): void {
        calls.push("seekTo");
        if (this.state === 5 || this.state === -1) this.setState(1); // autostart quirk
      }
      loadVideoById(id: string): void {
        calls.push(`loadVideoById:${id}`);
        this.swapVideo(id, 1); // always autostarts
      }
      cueVideoById(id: string, start?: number): void {
        calls.push(`cueVideoById:${id}@${start ?? 0}`);
        this.swapVideo(id, 5); // real API fires "video cued" too
      }
      // the real player fires state changes before getVideoData() catches up:
      // it keeps reporting the previous video's metadata until the new one loads
      private swapVideo(id: string, state: number): void {
        this.setState(state);
        setTimeout(() => {
          this.videoId = id;
          this.setState(state);
        }, 0);
      }
      getVideoData(): { title: string; video_id: string } {
        return { title: `Title of ${this.videoId}`, video_id: this.videoId };
      }
      getCurrentTime(): number {
        return 0;
      }
      getDuration(): number {
        return 300;
      }
      getPlayerState(): number {
        return this.state;
      }
      setPlaybackRate(): void {}
      setVolume(): void {}
      unMute(): void {}
      destroy(): void {}
    }
    (window as unknown as { YT?: unknown }).YT = { Player: FakePlayer, loaded: 1 };
  });
}

test("switching to a YouTube track while paused does not autoplay", async ({ page }) => {
  await blockYoutube(page);
  await fakeYoutubeApi(page);
  await page.goto("/");

  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  // the fake player reports a 300s duration once ready - proves API wiring
  await expect(page.getByTestId("loop-b")).toHaveValue("5:00.000");

  const topbarUrl = page.getByPlaceholder("Paste a YouTube link…");
  await topbarUrl.fill("https://www.youtube.com/watch?v=oHg5SJYRHA0");
  await topbarUrl.press("Enter");
  // second track keeps the 210s placeholder: it was cued, never played
  await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000");

  const ytState = () =>
    page.evaluate(() => {
      const yt = (window as unknown as { __yt: { calls: string[]; player: { state: number } } })
        .__yt;
      return { calls: yt.calls, state: yt.player.state };
    });

  // switching tracks cues the new video instead of load+autoplay
  await expect.poll(async () => (await ytState()).calls).toContain("cueVideoById:oHg5SJYRHA0@0");
  expect((await ytState()).state).not.toBe(1);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();

  // back to the first track via the sidebar - still no autoplay
  // (titles were patched from the fake player's getVideoData)
  await page.getByText("Title of dQw4w9WgXcQ").first().click();
  await expect(page.getByTestId("loop-b")).toHaveValue("5:00.000");
  await expect.poll(async () => (await ytState()).calls).toContain("cueVideoById:dQw4w9WgXcQ@0");
  const after = await ytState();
  expect(after.state).not.toBe(1);
  expect(after.calls.filter((c) => c.startsWith("loadVideoById") || c === "playVideo")).toEqual([]);

  // play still works on a cued video
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect((await ytState()).state).toBe(1);
});

test("a fresh YouTube player cues at the active loop's A point", async ({ page }) => {
  await blockYoutube(page);
  await fakeYoutubeApi(page);
  await page.goto("/");

  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByTestId("loop-b")).toHaveValue("5:00.000"); // fake player ready

  const a = page.getByTestId("loop-a");
  await a.fill("0:30.000");
  await a.press("Enter");
  await expect(a).toHaveValue("0:30.000");

  // a reload creates the player from scratch (cued at 0 by the IFrame API);
  // onReady must re-cue at loop A so the media matches the readout
  await page.reload();
  await expect(page.getByTestId("loop-a")).toHaveValue("0:30.000");
  await expect(page.getByTestId("time")).toHaveText("0:30.000");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __yt?: { calls: string[] } }).__yt?.calls ?? [],
      ),
    )
    .toContain("cueVideoById:dQw4w9WgXcQ@30");
});

test("YouTube poster cover hides the iframe UI before playback and clears once started", async ({
  page,
}) => {
  await blockYoutube(page);
  await fakeYoutubeApi(page);
  await page.goto("/");

  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByTestId("loop-b")).toHaveValue("5:00.000");

  // cued, never played: the opaque cover shields YouTube's title/share UI
  const cover = page.getByTestId("yt-cover");
  await expect(cover).toHaveCSS("opacity", "1");

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(cover).toHaveCSS("opacity", "0");

  // pause freezes on the current video frame - the cover must not come back
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(cover).toHaveCSS("opacity", "0");
  expect(
    await page.evaluate(
      () => (window as unknown as { __yt: { player: { state: number } } }).__yt.player.state,
    ),
  ).toBe(2);

  // switching to another video re-cues it: no frame yet, so cover returns
  const topbarUrl = page.getByPlaceholder("Paste a YouTube link…");
  await topbarUrl.fill("https://www.youtube.com/watch?v=oHg5SJYRHA0");
  await topbarUrl.press("Enter");
  await expect(cover).toHaveCSS("opacity", "1");
});

test("YouTube track title defaults to the video title once the player reports it", async ({
  page,
}) => {
  await blockYoutube(page);
  await fakeYoutubeApi(page);
  await page.goto("/");

  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");

  // placeholder replaced by the fake player's getVideoData().title
  await expect(page.getByText("Title of dQw4w9WgXcQ").first()).toBeVisible();
  await expect(page.getByText("YouTube loop")).toHaveCount(0);
});

test("a second YouTube track gets its own title, not the previous video's", async ({ page }) => {
  await blockYoutube(page);
  await fakeYoutubeApi(page);
  await page.goto("/");

  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByText("Title of dQw4w9WgXcQ").first()).toBeVisible();

  const topbarUrl = page.getByPlaceholder("Paste a YouTube link…");
  await topbarUrl.fill("https://www.youtube.com/watch?v=oHg5SJYRHA0");
  await topbarUrl.press("Enter");

  // the cue fires state changes while getVideoData() still reports the first
  // video - the new track must wait for its own metadata instead of inheriting
  await expect(page.getByText("Title of oHg5SJYRHA0").first()).toBeVisible();
  await expect(page.getByText("YouTube loop")).toHaveCount(0);
  await expect(page.getByText("Title of dQw4w9WgXcQ")).toHaveCount(1); // sidebar only
});

test("uploading an audio file decodes duration and spans the loop across it", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  await expect(page.getByText("sample").first()).toBeVisible();
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await expect(page.getByTestId("loop-len")).toHaveText("0:03.000");
});

test("renaming a track via the header title persists across reload", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  const title = page.getByLabel("Track title");
  await expect(title).toHaveValue("sample");
  await title.fill("Sweet Home Chicago");
  await title.press("Enter");
  await expect(page.getByText("Sweet Home Chicago")).toBeVisible(); // sidebar entry

  await page.reload();
  await expect(page.getByLabel("Track title")).toHaveValue("Sweet Home Chicago");

  // clearing the title falls back to "Untitled" on blur
  await page.getByLabel("Track title").fill("");
  await page.getByLabel("Track title").press("Enter");
  await expect(page.getByLabel("Track title")).toHaveValue("Untitled");
});

test("volume slider changes media volume and mute button toggles it", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  const video = page.locator("video");
  await page.getByLabel("Volume").fill("0.3");
  await expect(page.getByText("30%")).toBeVisible();
  await expect(video).toHaveJSProperty("volume", 0.3);

  await page.getByRole("button", { name: "Mute" }).click();
  await expect(video).toHaveJSProperty("volume", 0);
  await expect(page.getByText("0%")).toBeVisible();

  // unmute restores the pre-mute level
  await page.getByRole("button", { name: "Unmute" }).click();
  await expect(video).toHaveJSProperty("volume", 0.3);

  // volume survives playback start
  await page.getByRole("button", { name: "Play" }).click();
  await expect(video).toHaveJSProperty("volume", 0.3);
  await page.getByRole("button", { name: "Pause" }).click();
});

test("file track media survives reload and still plays", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");

  // media blob comes back from IndexedDB - the track plays without re-upload
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

test("typing one loop end in the trim field spans 10s from it", async ({ page }) => {
  await blockYoutube(page);
  await page.goto("/");
  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000"); // 210s placeholder

  // typing a start pulls the end 10s after it
  const a = page.getByTestId("loop-a");
  await a.fill("1:00.000");
  await a.press("Enter");
  await expect(a).toHaveValue("1:00.000");
  await expect(page.getByTestId("loop-b")).toHaveValue("1:10.000");
  await expect(page.getByTestId("loop-len")).toHaveText("0:10.000");

  // typing an end pushes the start 10s before it
  const b = page.getByTestId("loop-b");
  await b.fill("0:30.000");
  await b.press("Enter");
  await expect(a).toHaveValue("0:20.000");
  await expect(b).toHaveValue("0:30.000");

  // re-blurring an untouched field leaves the loop alone
  await a.focus();
  await a.blur();
  await expect(a).toHaveValue("0:20.000");
  await expect(b).toHaveValue("0:30.000");

  // near the end of the track the span is clamped, not pushed past the duration
  await a.fill("3:25.000");
  await a.press("Enter");
  await expect(b).toHaveValue("3:30.000");
  await expect(page.getByTestId("loop-len")).toHaveText("0:05.000");
});

test("setting loop B re-enables loop mode", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000"); // wait for decode

  const loopBtn = page.getByRole("button", { name: "Loop", exact: true });
  await expect(loopBtn).toHaveAttribute("aria-pressed", "true");

  // pressing B re-enables looping (playhead must be right of A first)
  await page.locator("body").press("ArrowRight");
  await page.locator("body").press("ArrowRight");
  await expect(page.getByTestId("time")).toHaveText("0:00.500");
  await loopBtn.click();
  await expect(loopBtn).toHaveAttribute("aria-pressed", "false");
  await page.locator("body").press("b");
  await expect(loopBtn).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:00.500");

  // so does the "Set B here" button
  await loopBtn.click();
  await page.getByRole("button", { name: "Set B here" }).click();
  await expect(loopBtn).toHaveAttribute("aria-pressed", "true");

  // and dragging the B handle in the waveform
  await loopBtn.click();
  const handle = page.locator(".cursor-ew-resize").filter({ hasText: "B" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  await expect(loopBtn).toHaveAttribute("aria-pressed", "true");
});

test("setting A past B (or B before A) is refused, not clamped", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000"); // wait for decode

  const body = page.locator("body");
  const setA = page.getByRole("button", { name: "Set A here" });
  const setB = page.getByRole("button", { name: "Set B here" });
  const seek = async (times: number, key: "ArrowLeft" | "ArrowRight") => {
    for (let i = 0; i < times; i++) await body.press(key);
  };

  // pull B in to 1s
  await seek(4, "ArrowRight");
  await expect(page.getByTestId("time")).toHaveText("0:01.000");
  await setB.click();
  await expect(page.getByTestId("loop-b")).toHaveValue("0:01.000");

  // playhead past B: setting A is refused, by button and by shortcut
  await seek(4, "ArrowRight");
  await expect(page.getByTestId("time")).toHaveText("0:02.000");
  await expect(setA).toBeDisabled();
  await body.press("a");
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");

  // mirror case: playhead before A leaves B alone
  await seek(6, "ArrowLeft");
  await expect(page.getByTestId("time")).toHaveText("0:00.500");
  await setA.click();
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.500");
  await seek(1, "ArrowLeft");
  await expect(page.getByTestId("time")).toHaveText("0:00.250");
  await expect(setB).toBeDisabled();
  await body.press("b");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:01.000");
});

test("undo / redo reverts the last loop edit, by button and by shortcut", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000"); // wait for decode

  const body = page.locator("body");
  const a = page.getByTestId("loop-a");
  const b = page.getByTestId("loop-b");
  const undo = page.getByTestId("loop-undo");
  const redo = page.getByTestId("loop-redo");

  // nothing edited yet
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  // set B at 1s, then A at 0.5s
  await body.press("ArrowRight");
  await body.press("ArrowRight");
  await body.press("ArrowRight");
  await body.press("ArrowRight");
  await page.getByRole("button", { name: "Set B here" }).click();
  await expect(b).toHaveValue("0:01.000");
  await body.press("ArrowLeft");
  await body.press("ArrowLeft");
  await page.getByRole("button", { name: "Set A here" }).click();
  await expect(a).toHaveValue("0:00.500");

  // Ctrl+Z takes back the A set, then the B set
  await body.press("Control+z");
  await expect(a).toHaveValue("0:00.000");
  await expect(b).toHaveValue("0:01.000");
  await body.press("Control+z");
  await expect(b).toHaveValue("0:03.000");
  await expect(undo).toBeDisabled();

  // Ctrl+Shift+Z replays them
  await body.press("Control+Shift+z");
  await expect(b).toHaveValue("0:01.000");
  await body.press("Control+Shift+z");
  await expect(a).toHaveValue("0:00.500");
  await expect(redo).toBeDisabled();

  // the buttons do the same
  await undo.click();
  await expect(a).toHaveValue("0:00.000");
  await redo.click();
  await expect(a).toHaveValue("0:00.500");

  // a fresh edit drops the redo branch
  await undo.click();
  await expect(redo).toBeEnabled();
  await b.fill("0:02.000");
  await b.press("Enter");
  await expect(redo).toBeDisabled();
});

test("loop history holds 10 steps, is per loop, and collapses a drag", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000"); // wait for decode

  const a = page.getByTestId("loop-a");
  const undo = page.getByTestId("loop-undo");

  // 12 edits, only the last 10 are undoable
  for (let i = 1; i <= 12; i++) {
    await a.fill(`0:00.${String(i * 10).padStart(3, "0")}`);
    await a.press("Enter");
  }
  await expect(a).toHaveValue("0:00.120");
  for (let i = 0; i < 10; i++) await undo.click();
  await expect(a).toHaveValue("0:00.020"); // state after the 2nd edit
  await expect(undo).toBeDisabled();

  // a new loop starts with its own empty history
  await page.locator("body").press("n");
  await expect(undo).toBeDisabled();

  // one whole drag of the B handle is one undo step
  const before = await page.getByTestId("loop-b").inputValue();
  const handle = page.locator(".cursor-ew-resize").filter({ hasText: "B" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("loop-b")).not.toHaveValue(before);
  await undo.click();
  await expect(page.getByTestId("loop-b")).toHaveValue(before);
  await expect(undo).toBeDisabled();
});

test("switching tracks seeks the playhead to the active loop start", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3, "one.wav");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000"); // wait for decode

  // move loop A off zero on the first track
  const a = page.getByTestId("loop-a");
  await a.fill("0:01.000");
  await a.press("Enter");
  await expect(a).toHaveValue("0:01.000");

  // a second track is auto-selected on upload
  await page.locator('input[accept="audio/*,video/*"]').setInputFiles({
    name: "two.wav",
    mimeType: "audio/wav",
    buffer: makeWav(3),
  });
  await expect(page.getByText("two").first()).toBeVisible();
  await expect(page.getByTestId("time")).toHaveText("0:00.000");

  // switching back lands the playhead on the loop's A point...
  await page.getByText("one").first().click();
  await expect(page.getByTestId("time")).toHaveText("0:01.000");
  // ...and the media element really seeked there (a currentTime set right
  // after src= is silently dropped by the load algorithm without the
  // loadedmetadata re-seek)
  await expect
    .poll(() => page.evaluate(() => document.querySelector("video")?.currentTime))
    .toBeCloseTo(1, 1);
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

test("search clear button appears with text and resets the filter", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

  const search = page.getByPlaceholder("Search loops & tags");
  const clear = page.getByRole("button", { name: "Clear search" });
  await expect(clear).toBeHidden(); // no cross while empty

  await search.fill("zzz");
  await expect(clear).toBeVisible();
  await expect(page.locator("[data-track-id]")).toHaveCount(0);

  await clear.click();
  await expect(search).toHaveValue("");
  await expect(clear).toBeHidden();
  await expect(page.locator("[data-track-id]")).toHaveCount(1);
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

    // exact - otherwise "Add a loop at the playhead (N)" also matches
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByTestId("time")).not.toHaveText("0:00.000", { timeout: 5000 });
  });

  test("YouTube link is added through the add sheet", async ({ page }) => {
    await blockYoutube(page);
    await page.goto("/");

    // the toolbar can't fit the ingest controls this narrow: one "+" replaces them
    await expect(page.getByPlaceholder("Paste a YouTube link…")).toBeHidden();
    await expect(page.getByTestId("open-record")).toBeHidden();
    await page.getByTestId("open-add-menu").click();
    await page.getByTestId("add-youtube").click();
    await expect(page.getByTestId("add-track-sheet")).toBeHidden(); // sheet gives way to the modal

    const input = page.getByPlaceholder("youtube.com/watch?v=…").last(); // modal's, not empty-state's
    await input.fill("not a link");
    await input.press("Enter");
    await expect(page.getByText("That doesn't look like a YouTube link.")).toBeVisible();

    await input.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await input.press("Enter");
    await expect(page.getByText("Add a YouTube link", { exact: true })).toBeHidden(); // modal closed
    await expect(page.getByTestId("loop-b")).toHaveValue("3:30.000");
  });

  test("add sheet lists every ingest path without scrolling and picks a local file", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("open-add-menu").click();

    const sheet = page.getByTestId("add-track-sheet");
    await expect(sheet).toBeVisible();
    for (const id of ["add-youtube", "add-file", "add-record"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // all three options fit the viewport - nothing to scroll to reach them
    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await sheet.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);

    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("add-file").click();
    await (await chooser).setFiles({
      name: "sample.wav",
      mimeType: "audio/wav",
      buffer: makeWav(3),
    });

    await expect(sheet).toBeHidden(); // picking a file closes the sheet
    await expect(page.getByLabel("Track title")).toHaveValue("sample");
  });

  test("add sheet opens the recorder", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-add-menu").click();
    await page.getByTestId("add-record").click();
    await expect(page.getByTestId("add-track-sheet")).toBeHidden();
    await expect(page.getByTestId("record-modal")).toBeVisible();
  });
});

test("dragging a library entry reorders it, persists, and does not select on drop", async ({
  page,
}) => {
  await page.goto("/");
  await uploadWav(page, 3, "alpha.wav");
  await uploadWav(page, 4, "bravo.wav");

  const rows = page.locator("[data-track-id]");
  await expect(rows).toHaveCount(2);
  // newest track is prepended
  await expect(rows.nth(0)).toContainText("bravo");
  await expect(rows.nth(1)).toContainText("alpha");
  await expect(page.getByLabel("Track title")).toHaveValue("bravo");

  const drag = async (fromIndex: number, toIndex: number, edge: "top" | "bottom") => {
    const from = await rows.nth(fromIndex).boundingBox();
    const to = await rows.nth(toIndex).boundingBox();
    if (!from || !to) throw new Error("row not laid out");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    const y = edge === "bottom" ? to.y + to.height * 0.8 : to.y + to.height * 0.2;
    await page.mouse.move(to.x + to.width / 2, y, { steps: 12 });
    await page.mouse.up();
  };

  // drop "bravo" below "alpha"
  await drag(0, 1, "bottom");
  await expect(rows.nth(0)).toContainText("alpha");
  await expect(rows.nth(1)).toContainText("bravo");
  // the drag must not double as a click that switches tracks
  await expect(page.getByLabel("Track title")).toHaveValue("bravo");

  await page.reload();
  await expect(page.locator("[data-track-id]").nth(0)).toContainText("alpha");
  await expect(page.locator("[data-track-id]").nth(1)).toContainText("bravo");

  // a plain click still selects
  await page.locator("[data-track-id]").nth(0).click();
  await expect(page.getByLabel("Track title")).toHaveValue("alpha");
});

test("removing the last track returns to the empty state", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.getByTitle("Remove", { exact: true }).click();
  await expect(page.getByTestId("confirm-remove")).toContainText("sample");
  await page.getByTestId("confirm-remove-ok").click();
  await expect(
    page.getByRole("heading", { name: "Loop anything" }),
  ).toBeVisible();
});

test("cancelling the remove confirmation keeps the track", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3, "keeper.wav");
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  // cancel button
  await page.getByTitle("Remove", { exact: true }).click();
  await page.getByTestId("confirm-remove-cancel").click();
  await expect(page.getByTestId("confirm-remove")).toHaveCount(0);
  await expect(page.locator("[data-track-id]")).toHaveCount(1);

  // Escape does the same, and does not reach the transport behind the dialog
  await page.getByTitle("Remove", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("confirm-remove")).toHaveCount(0);
  await expect(page.locator("[data-track-id]")).toHaveCount(1);
  await expect(page.getByLabel("Track title")).toHaveValue("keeper");
});

/** The × on the extra-media panel is guarded by a confirmation dialog. */
async function removeExtraMedia(page: Page, title: "Remove image" | "Remove notes") {
  await page.getByTitle(title).click();
  await page.getByTestId("confirm-remove-extra-media-ok").click();
}

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

  // remove button clears it, once confirmed
  await removeExtraMedia(page, "Remove image");
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

test("cover hint shows on file tracks without an image and uploads via click", async ({
  page,
}) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

  // hint strip sits above the video panel while the track has no image
  const hint = page.getByTestId("extra-media-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText("drag & drop, or paste");

  // clicking the hint opens a file picker; picking an image sets the cover
  await hint.locator('input[type="file"]').setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });
  await expect(page.getByTestId("track-image")).toBeVisible();
  await expect(hint).toHaveCount(0);

  // removing the image brings the hint back
  await removeExtraMedia(page, "Remove image");
  await expect(page.getByTestId("extra-media-hint")).toBeVisible();
});

test("cover image works on a YouTube track too", async ({ page }) => {
  await blockYoutube(page);
  await page.goto("/");
  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByText("YouTube loop").first()).toBeVisible();

  // hint strip sits above the video panel, same as on file tracks
  const hint = page.getByTestId("extra-media-hint");
  await expect(hint).toBeVisible();
  await hint.locator('input[type="file"]').setInputFiles({
    name: "chart.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });

  // image and the YouTube video panel coexist
  await expect(page.getByTestId("track-image")).toBeVisible();
  await expect(page.getByTestId("yt-cover")).toBeVisible();

  // data URL, so it survives the guest localStorage round-trip
  await page.reload();
  await expect(page.getByTestId("track-image")).toBeVisible();
});

test("markdown notes: toolbar, preview, save, edit and remove", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

  await page.getByTestId("add-notes").click();
  const input = page.getByTestId("markdown-input");
  await expect(input).toBeVisible();

  // toolbar with an empty selection inserts the placeholder already wrapped
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(input).toHaveValue("**bold text**");

  await input.fill("## Verse riff\n\nAm - F - C - G");

  // preview tab renders the markdown; the editor keeps the source
  await page.getByTestId("markdown-preview-tab").click();
  await expect(
    page.getByTestId("markdown-preview").getByRole("heading", { name: "Verse riff" }),
  ).toBeVisible();

  await page.getByTestId("markdown-save").click();
  const notes = page.getByTestId("track-markdown");
  await expect(notes.getByRole("heading", { name: "Verse riff" })).toBeVisible();
  await expect(notes).toContainText("Am - F - C - G");
  await expect(page.getByTestId("markdown-editor")).toHaveCount(0);

  // markdown is plain text, so it survives the guest localStorage round-trip
  await page.reload();
  await expect(page.getByTestId("track-markdown")).toContainText("Am - F - C - G");

  // edit re-opens the editor on the saved source; cancel leaves it untouched
  await page.getByTestId("edit-notes").click();
  await expect(page.getByTestId("markdown-input")).toHaveValue(/Verse riff/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("track-markdown")).toContainText("Am - F - C - G");

  // removing brings the hint strip back
  await removeExtraMedia(page, "Remove notes");
  await expect(page.getByTestId("track-markdown")).toHaveCount(0);
  await expect(page.getByTestId("extra-media-hint")).toBeVisible();
});

test("cancelling the extra-media confirmation keeps the notes", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.getByTestId("add-notes").click();
  await page.getByTestId("markdown-input").fill("keep me");
  await page.getByTestId("markdown-save").click();
  await expect(page.getByTestId("track-markdown")).toContainText("keep me");

  await page.getByTitle("Remove notes").click();
  await expect(page.getByTestId("confirm-remove-extra-media")).toBeVisible();
  await page.getByTestId("confirm-remove-extra-media-cancel").click();
  await expect(page.getByTestId("confirm-remove-extra-media")).toHaveCount(0);
  await expect(page.getByTestId("track-markdown")).toContainText("keep me");

  // Escape closes it too, without deleting
  await page.getByTitle("Remove notes").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("confirm-remove-extra-media")).toHaveCount(0);
  await expect(page.getByTestId("track-markdown")).toContainText("keep me");
});

test("a track holds one extra media: notes replace an image", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.getByTestId("extra-media-hint").locator('input[type="file"]').setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });
  await expect(page.getByTestId("track-image")).toBeVisible();

  // no hint strip while an image is set, so notes are added from the editor
  // reached after removing it
  await removeExtraMedia(page, "Remove image");
  await page.getByTestId("add-notes").click();
  await page.getByTestId("markdown-input").fill("chords only");
  await page.getByTestId("markdown-save").click();

  await expect(page.getByTestId("track-markdown")).toContainText("chords only");
  await expect(page.getByTestId("track-image")).toHaveCount(0);
});

test("notes take the same box as an image, so the controls don't move", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  await page.getByTestId("extra-media-hint").locator('input[type="file"]').setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });
  await expect(page.getByTestId("track-image")).toBeVisible();
  const withImage = (await page.getByTestId("time").boundingBox())!.y;

  await removeExtraMedia(page, "Remove image");
  await page.getByTestId("add-notes").click();
  await page.getByTestId("markdown-input").fill("one short line");
  await page.getByTestId("markdown-save").click();
  await expect(page.getByTestId("track-markdown")).toContainText("one short line");

  // a one-line note fills the same leftover height an image did
  const withNotes = (await page.getByTestId("time").boundingBox())!.y;
  expect(Math.abs(withNotes - withImage)).toBeLessThan(2);
});

test("a legacy stored `image` field is migrated to extra media", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  // rewrite the guest library the way a pre-extraMedia build wrote it
  await page.evaluate((b64) => {
    const lib = JSON.parse(localStorage.getItem("multilooper_guest_lib")!);
    lib.tracks[0].image = `data:image/png;base64,${b64}`;
    delete lib.tracks[0].extraMedia;
    localStorage.setItem("multilooper_guest_lib", JSON.stringify(lib));
  }, TINY_PNG);

  await page.reload();
  await expect(page.getByTestId("track-image")).toBeVisible();

  // and it is rewritten as one segment spanning the whole track, so the legacy
  // field stops round-tripping
  await expect
    .poll(async () =>
      await page.evaluate(() => {
        const lib = JSON.parse(localStorage.getItem("multilooper_guest_lib")!);
        const segs = lib.tracks[0].extraMedia;
        return [segs?.length, segs?.[0]?.media?.type, segs?.[0]?.start, lib.tracks[0].image ?? null];
      }),
    )
    .toEqual([1, "image", 0, null]);
});

/** Seek by clicking the times ruler at a fraction of the track. */
async function seekRuler(page: Page, ratio: number) {
  const ruler = page.getByTestId("extra-times-ruler");
  const box = (await ruler.boundingBox())!;
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
}

async function addImageAndOpenTimes(page: Page, seconds: number) {
  await uploadWav(page, seconds);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode
  await page.getByTestId("extra-media-hint").locator('input[type="file"]').setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });
  await expect(page.getByTestId("track-image")).toBeVisible();
  await page.getByTestId("extra-times-toggle").click();
  await expect(page.getByTestId("extra-times-strip")).toBeVisible();
}

test("the first extra media spans the whole track as one segment", async ({ page }) => {
  await page.goto("/");
  await addImageAndOpenTimes(page, 10);

  await expect(page.getByTestId("extra-segment")).toHaveCount(1);
  await expect(page.getByTestId("segment-start")).toHaveText("0:00.000");
  await expect(page.getByTestId("segment-end")).toHaveText("0:10.000");
  // the outer ends are pinned to the track, so neither nudges
  await expect(page.getByTitle("−100ms").first()).toBeDisabled();
});

test("adding at the playhead carves the segment in two, the new half empty", async ({
  page,
}) => {
  await page.goto("/");
  await addImageAndOpenTimes(page, 10);

  await seekRuler(page, 0.5);
  await page.getByTestId("add-extra-media").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  // the playhead sits in the new half, which has no media of its own yet
  await expect(page.getByTestId("extra-media-hint")).toBeVisible();
  await expect(page.getByTestId("track-image")).toHaveCount(0);
  await expect(page.getByTestId("segment-start")).toHaveText(/^0:05\./);
  await expect(page.getByTestId("segment-end")).toHaveText("0:10.000");

  // the panel follows the playhead back into the first half
  await seekRuler(page, 0.1);
  await expect(page.getByTestId("track-image")).toBeVisible();
  await expect(page.getByTestId("extra-media-hint")).toHaveCount(0);

  // segments survive the guest localStorage round-trip
  await page.reload();
  await page.getByTestId("extra-times-toggle").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);
});

test("dragging a shared edge retimes both neighbours, never opening a gap", async ({ page }) => {
  await page.goto("/");
  await addImageAndOpenTimes(page, 10);
  await seekRuler(page, 0.5);
  await page.getByTestId("add-extra-media").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  const strip = (await page.getByTestId("extra-times-strip").boundingBox())!;
  const handle = (await page.getByTestId("extra-boundary").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width * 0.25, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();

  // the selected (second) segment now starts at the new edge...
  await expect(page.getByTestId("segment-start")).toHaveText(/^0:02\./);
  // ...and the first segment ends there too - one edge, no gap
  const [firstEnd, secondStart] = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem("multilooper_guest_lib")!);
    const segs = lib.tracks[0].extraMedia;
    return [segs[0].end, segs[1].start];
  });
  expect(firstEnd).toBe(secondStart);
  expect(firstEnd).toBeGreaterThan(2);
  expect(firstEnd).toBeLessThan(3);
});

test("deleting a segment hands its time back to the neighbour, after a confirm", async ({
  page,
}) => {
  await page.goto("/");
  await addImageAndOpenTimes(page, 10);
  await seekRuler(page, 0.5);
  await page.getByTestId("add-extra-media").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  // cancelling leaves both segments alone
  await page.getByTestId("delete-segment").click();
  await page.getByTestId("confirm-remove-extra-media-cancel").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  await page.getByTestId("delete-segment").click();
  await expect(page.getByTestId("confirm-remove-extra-media")).toBeVisible();
  await page.getByTestId("confirm-remove-extra-media-ok").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(1);
  // the survivor covers the whole track again
  await expect(page.getByTestId("segment-start")).toHaveText("0:00.000");
  await expect(page.getByTestId("segment-end")).toHaveText("0:10.000");
  await expect(page.getByTestId("track-image")).toBeVisible();
});

test("only one empty segment at a time: add at playhead waits for it to be filled", async ({
  page,
}) => {
  await page.goto("/");
  await addImageAndOpenTimes(page, 10);
  await seekRuler(page, 0.5);
  await page.getByTestId("add-extra-media").click();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  // the new half is empty, so carving another one is refused
  await seekRuler(page, 0.8);
  await expect(page.getByTestId("add-extra-media")).toBeDisabled();
  // ...until it gets media of its own
  await page.getByTestId("extra-media-hint").locator('input[type="file"]').setInputFiles({
    name: "second.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG, "base64"),
  });
  await expect(page.getByTestId("track-image")).toBeVisible();
  await expect(page.getByTestId("add-extra-media")).toBeEnabled();
});

test("removing a segment's media hands its time to the left, or right for the first", async ({
  page,
}) => {
  const segs = () =>
    page.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem("multilooper_guest_lib")!);
      return (lib.tracks[0].extraMedia ?? []).map((s: { start: number; end: number }) => [
        s.start,
        s.end,
      ]);
    });
  const fill = (name: string) =>
    page.getByTestId("extra-media-hint").locator('input[type="file"]').setInputFiles({
      name,
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG, "base64"),
    });

  await page.goto("/");
  await addImageAndOpenTimes(page, 10);
  await seekRuler(page, 0.5);
  await page.getByTestId("add-extra-media").click();
  await fill("second.png");
  await expect(page.getByTestId("track-image")).toBeVisible();
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);

  // × on the second segment: it goes, the first stretches to the end
  await removeExtraMedia(page, "Remove image");
  await expect(page.getByTestId("extra-segment")).toHaveCount(1);
  await expect.poll(segs).toEqual([[0, 10]]);
  await expect(page.getByTestId("extra-media-hint")).toHaveCount(0);

  // split again, fill, then × on the first: the second takes over from 0
  await page.getByTestId("add-extra-media").click();
  await fill("third.png");
  await expect(page.getByTestId("extra-segment")).toHaveCount(2);
  await seekRuler(page, 0.1);
  await removeExtraMedia(page, "Remove image");
  await expect(page.getByTestId("extra-segment")).toHaveCount(1);
  await expect.poll(segs).toEqual([[0, 10]]);
});

test("cover image resizes via the grip, persists, and resets on window resize", async ({
  page,
}) => {
  // a taller window than the default so the auto-fitted image has room to be
  // dragged shorter without hitting the panel's minimum height
  await page.setViewportSize({ width: 1280, height: 1000 });
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
  const gb = (await page.getByTestId("extra-media-resize-grip").boundingBox())!;
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
  expect(await page.evaluate(() => localStorage.getItem("multilooper_extra_media_heights"))).toBeNull();
});

test("track number in the URL: selection updates it, deep links and invalid paths resolve", async ({
  page,
}) => {
  // no tracks: a track URL falls back to the home page
  await page.goto("/5");
  await expect(page.getByRole("heading", { name: "Loop anything" })).toBeVisible();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

  await uploadWav(page, 3, "first.wav");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await expect(page).toHaveURL(/\/1$/);

  // new tracks are prepended: "second" becomes #1, "first" shifts to #2
  await uploadWav(page, 2, "second.wav");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:02.000");
  await expect(page).toHaveURL(/\/1$/);

  // picking a track in the sidebar mirrors its number into the URL
  await page.getByText("first").first().click();
  await expect(page.getByTestId("loop-b")).toHaveValue("0:03.000");
  await expect(page).toHaveURL(/\/2$/);

  // deep link loads the track by number
  await page.goto("/1");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:02.000");

  // out-of-range number falls back to the first track and rewrites the URL.
  // Stay inside the pre-rendered /1../20 range: past it the dev server honours
  // `dynamicParams = false` and 404s, while production nginx falls back to
  // index.html (`try_files … /index.html`) and the app resolves the number.
  await page.goto("/20");
  await expect(page.getByTestId("loop-b")).toHaveValue("0:02.000");
  await expect(page).toHaveURL(/\/1$/);

  // a non-track path is a real 404, not the app
  await page.goto("/help");
  await expect(page.getByTestId("loop-b")).toBeHidden();
});

test("keyboard shortcut N adds a second loop", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);

  await expect(page.getByTitle("Rename loop")).toHaveCount(1);
  await page.locator("body").press("n");
  await expect(page.getByTitle("Rename loop")).toHaveCount(2);
});

test("keyboard shortcut S toggles the shortcuts modal", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 3);
  // shortcuts no-op until a track is in the store - wait for the decode
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  const heading = page.getByRole("heading", { name: "Keyboard shortcuts" });
  await expect(heading).not.toBeVisible();
  await page.locator("body").press("s");
  await expect(heading).toBeVisible();
  await page.locator("body").press("s");
  await expect(heading).not.toBeVisible();
});

test("keyboard shortcut R plays from the loop start", async ({ page }) => {
  await page.goto("/");
  await uploadWav(page, 6);

  const a = page.getByTestId("loop-a");
  await a.fill("0:02.000"); // shortcuts ignore keys until a track exists
  await a.press("Enter");
  await expect(a).toHaveValue("0:02.000");

  const time = page.getByTestId("time");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(time).toHaveText(/^0:0[3-5]\./, { timeout: 5000 }); // ran past the loop start

  await page.locator("body").press("r");
  await expect(time).toHaveText(/^0:02\./);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // also starts playback when paused
  await page.getByRole("button", { name: "Pause" }).click();
  await page.locator("body").press("r");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("A/B badges stay inside the waveform at track edges and never overlap when close", async ({
  page,
}) => {
  await blockYoutube(page);
  await page.goto("/");
  const url = page.getByPlaceholder("youtube.com/watch?v=…");
  await url.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await url.press("Enter");
  await expect(page.getByTestId("loop-a")).toHaveValue("0:00.000");

  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  type Box = { x: number; y: number; width: number; height: number };
  const intersect = (r: Box, s: Box) =>
    r.x < s.x + s.width && s.x < r.x + r.width && r.y < s.y + s.height && s.y < r.y + r.height;

  // full-track loop: A hugs the left edge, B hugs the right edge - both badges
  // must be flipped inward so they stay inside the strip
  const wave = await box("waveform");
  let a = await box("loop-label-a");
  let b = await box("loop-label-b");
  expect(a.x).toBeGreaterThanOrEqual(wave.x - 1);
  expect(b.x + b.width).toBeLessThanOrEqual(wave.x + wave.width + 1);

  // markers close together mid-track: badges must not overlap
  const aIn = page.getByTestId("loop-a");
  const bIn = page.getByTestId("loop-b");
  await aIn.fill("1:00.000");
  await aIn.press("Enter");
  await bIn.fill("1:00.100");
  await bIn.press("Enter");
  await expect(bIn).toHaveValue("1:00.100");
  a = await box("loop-label-a");
  b = await box("loop-label-b");
  expect(intersect(a, b)).toBe(false);

  // markers close together at the very start: both badges forced rightward,
  // so B must dodge (stagger below) instead of covering A
  await aIn.fill("0:00.000");
  await aIn.press("Enter");
  await bIn.fill("0:00.100");
  await bIn.press("Enter");
  await expect(bIn).toHaveValue("0:00.100");
  a = await box("loop-label-a");
  b = await box("loop-label-b");
  expect(a.x).toBeGreaterThanOrEqual(wave.x - 1);
  expect(intersect(a, b)).toBe(false);
});

test("on a phone the notes editor and the saved note stay above the waveform", async ({
  browser,
}) => {
  // A phone has no leftover column height to hand out: a panel that still asks
  // for it collapsed to nothing and its content painted over the waveform.
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 760 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await uploadWav(page, 24);
  await expect(page.getByTitle("Rename loop")).toHaveCount(1);

  const waveTop = async () => (await page.getByTestId("waveform").boundingBox())!.y;

  await page.getByTestId("add-notes").click();
  const area = page.getByTestId("markdown-input");
  const editor = (await page.getByTestId("markdown-editor").boundingBox())!;
  expect((await area.boundingBox())!.height).toBeGreaterThan(120);
  expect(editor.y + editor.height).toBeLessThanOrEqual(await waveTop());

  await area.fill("# Chords\n\nAm G F E\n\n- watch the pickup on bar 4");
  await page.getByTestId("markdown-save").click();
  const note = (await page.getByTestId("track-markdown").boundingBox())!;
  await expect(page.getByTestId("track-markdown")).toContainText("watch the pickup");
  expect(note.y + note.height).toBeLessThanOrEqual(await waveTop());

  // hover-only corner buttons are always shown on a touch screen, or a saved
  // note could never be edited or removed there
  await expect(page.getByTestId("edit-notes")).toHaveCSS("opacity", "1");
  await page.getByTestId("edit-notes").click();
  await expect(page.getByTestId("markdown-editor")).toBeVisible();
  await ctx.close();
});

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 720 }],
  ["phone", { width: 360, height: 740 }],
] as const) {
  test(`player controls stack in order on ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await uploadWav(page, 3);
    await expect(page.getByTitle("Rename loop")).toHaveCount(1); // wait for decode

    // play/time/loop, set A/B + undo/redo, loop chips, start/end/length, speed + volume
    const rows = [
      page.getByTestId("time"),
      page.getByRole("button", { name: "Set A here" }),
      page.getByTitle("Rename loop"),
      page.getByTestId("loop-a"),
      page.getByTitle(/Type a speed/),
      page.getByRole("button", { name: "Mute" }),
    ];
    const ys: number[] = [];
    for (const row of rows) ys.push((await row.boundingBox())!.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });
}
