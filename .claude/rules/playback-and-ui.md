# Playback, Loop Editing & UI

Playback (`src/lib/player/controller.ts`): singleton `player` outside React — the single clock source per track. Backends: YouTube IFrame API (`controls:0`; app transport is the only control) or a `<video>` element for local files (also audio). A `requestAnimationFrame` tick reads media time and enforces the A→B loop; playhead/time readout update **imperatively** via `player.onTime()` listeners so React never renders at frame rate — keep it that way. Real durations arrive late (YT placeholder 210s, failed decode 120s) and flow through `library.patchDuration`, which re-clamps loops and keeps full-span loops full.

Loop editing: all clamped A/B operations (set/nudge, min gap 0.05s) live in `src/lib/loopEdit.ts`, shared by UI buttons and keyboard shortcuts (`components/ShortcutsProvider.tsx`). Don't patch `a`/`b` directly from components — go through `loopEdit` or `library.patchActiveLoop`.

UI composition: `app/page.tsx` → `TopBar` + `Sidebar` (library) + `PlayerMain` (`TrackHeader`, `VideoPanel`, `Waveform`, `LoopStrip`, `LoopTrim`, `Transport`) + modals. `Waveform` paints bars inside the loop region with the track accent color.
