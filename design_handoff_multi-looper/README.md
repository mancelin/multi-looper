# Handoff: multi-looper — Music Loop Player & Manager

## Overview
multi-looper is a dark, DAW-style web app for **practicing along to music by looping sections of a track**. A musician loads audio/video (YouTube links or local files), sets A/B loop points on a real waveform, and repeats that section indefinitely — optionally slowed down (pitch-preserved). Each song holds a **collection of named loops**; the user selects the active loop. Optional **accounts** save the library across devices. The app is fully usable **without an account**.

Primary user: **musicians practicing an instrument.** Core workflow: load a song → pick/create a loop → set precise A/B points → practice at a chosen speed, watching the video if present.

## About the Design Files
`multi-looper.dc.html` is a **working HTML prototype** showing the intended look and behavior. It is authored in a bespoke "Design Component" runtime (an `<x-dc>` template + a `class Component` logic block) — treat that wrapper as scaffolding, **not** a target architecture. Recreate the design in the target codebase's own environment (React/Vue/Svelte/etc.) using its established patterns. The audio/video/looping logic (Web Audio decode, `requestAnimationFrame` loop watcher, YouTube IFrame API, `<video>` playback) is real and reusable — port the *approach*, not the literal class.

## Fidelity
**High-fidelity.** Colors, type, spacing, and interactions are specified below; recreate faithfully using the codebase's component library where one exists, else the exact tokens here.

---

## App States

### 1. Init / empty state (no tracks)
Shown whenever the library is empty. Centered onboarding hero over the main radial-gradient background:
- Animated equalizer mark: 96×96 rounded-24px tile, `linear-gradient(135deg,#12303080,#0e1116)`, teal border, four bars (`#5eead4`/`#2dd4bf`/`#0ea5a4`) animating height via `@keyframes eq {0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}` with staggered negative delays.
- Headline (30px/700, `#fff`): “Loop anything. Master every bar.” + 15px `#8a92a2` subcopy.
- Two side-by-side cards (each `flex:1;min-width:270px;max-width:340px`, `#0f1319`, radius 16px): **Paste a link** (YouTube glyph + inline URL input + teal Add button) and **Upload audio** (dashed teal border, click opens file picker).
- The top bar (with its own YouTube input + Upload) stays visible above.

### 2. Player (≥1 track)
Two-pane: library sidebar (collapsible) + player main. See Components.

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOPBAR 58px:  [☰] multi-looper │ [YT input][Add] [Upload] [⌨]      [Sign in]│  ← sign-in right-aligned (margin-left:auto)
├────────────────┬───────────────────────────────────────────────────────┤
│ LIBRARY        │ MAIN (scrolls if too short)                           │
│ 300px          │  • Track header (thumb + badge + title + artist + TAGS)│
│ (260 narrow,   │  • VIDEO PANEL (only for video tracks; auto-fit height)│
│  collapsible)  │  • Waveform (constant 132px)                          │
│                │  • Ruler (7 ticks)                                    │
│                │  • LOOPS strip (pills + Add loop)                     │
│                │  • Loop readout + trim (START/END/LENGTH, Set A/B)    │
│                │  • Transport (prev/play/next, time, Loop, SPEED)      │
└────────────────┴───────────────────────────────────────────────────────┘
```
- Shell: `display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#0c0e12`.
- Body row `display:flex;flex:1;min-height:0`; sidebar `flex:none`; `<main>` `flex:1;overflow-y:auto`, background `radial-gradient(120% 80% at 50% -10%,#12161d,#0c0e12 60%)`.
- **Responsive:** below **820px** → `narrow` (sidebar 260px). Sidebar is **collapsible in all modes** via the top-left ☰ (toggles `sidebarOpen` → `display:none`).

---

## Components

### Top bar (58px, `#0e1116`, bottom border `rgba(255,255,255,.07)`) — three groups L→R
1. **☰ collapse** (34×34, `#161a21`, border `rgba(255,255,255,.1)`, radius 8) + **wordmark** (26×26 teal-gradient tile w/ equalizer glyph + “multi-looper” 14px/700, letter-spacing .14em).
2. **YouTube input** (flex group, max 640px): `#14171d` field, radius 9, height 38, red YT glyph, placeholder “Paste a YouTube link…”, teal **Add** button (Enter also submits). **Upload file** button (same chrome, upload glyph). **⌨ shortcuts** button (38×38). Hidden `<input type="file" accept="audio/*,video/*" multiple>`.
3. **Account** (pushed right with `margin-left:auto`): see Accounts.

### Library sidebar (`#0e1116`, right border)
- Header: “LIBRARY” eyebrow (11px/600, .13em, `#6b7280`) + track count.
- Search field (`#14171d`, radius 8, height 34) — filters by title/artist/**tag** (case-insensitive).
- Track rows (radius 10): active row `rgba(94,234,212,.08)` + border `rgba(94,234,212,.28)` + 3px left accent bar (track accent color). 44×44 art tile shows the thumbnail (YouTube: `https://img.youtube.com/vi/<id>/mqdefault.jpg`) else a music-note glyph. Title (active `#fff` else `#d5dae2`), `m:ss` duration · artist, tag chips (9.5px), and a trailing **×** remove (hover `#f87171`). Removing the current track selects the first remaining; never removes the last.

### Track header (`padding:20px 26px 14px`)
- 66×66 tile (radius 11): thumbnail if any, else music-note glyph in the track accent.
- Source **badge** (10px/600, .1em): `YOUTUBE` (`#fca5a5`/`rgba(248,113,113,.1)`), `LOCAL FILE`/`LOCAL VIDEO` (`#93c5fd`/`#c4b5fd`), else demo teal. Title `h1` 21px/600; artist 13px `#8a92a2`.
- **Tag editor** (below artist): each tag a chip (11px, `rgba(255,255,255,.05)`) with an inline **×** to remove; a **+ tag** input (66→96px on focus) adds on Enter/comma; Backspace on empty removes the last; duplicates ignored. Tags feed sidebar search.

### Video panel (only when the track has video — `videoPanelDisplay` flex)
- Shown for **YouTube** tracks and **video files** (file with a live object URL); hidden for audio-only.
- Container is `display:flex;align-items:center;justify-content:center` (keeps the player **centered**). Inner box: `width:{videoWidth}px;max-width:100%;aspect-ratio:16/9;background:#000;radius 12;overflow:hidden`, shadow `0 8px 30px rgba(0,0,0,.4)`.
- **Auto-fit (default):** on load / window resize / track change, JS sizes the box to the **maximum height that lets the whole UI fit without scrolling**. Method: measure `main.clientHeight - main.scrollHeight` (the vertical overflow/spare), adjust the box height by that delta over ~3 passes, derive width = `height*16/9`, clamp to `[240px .. container width]` with a **150px minimum height**; if the viewport is genuinely too short, it stays at the minimum and `main` scrolls.
- **Manual resize:** a grip in the bottom-right corner (`cursor:nwse-resize`, uses pointer capture so drags work over the iframe). Dragging sets width = `2*(cursorX − containerCenterX)` clamped `[280 .. container width]`, staying centered; this sets a session flag that suppresses auto-fit until reload.
- **Playback surface:** YouTube renders via the IFrame API with **`controls:0`** (no native controls — the app's transport is the sole control, guaranteeing time sync). Video files play through a `<video>` element (same element referenced as the media handle). A transparent full-box overlay (below the resize grip) calls play/pause on click.

### Waveform (constant **132px** height, radius 12, `#0f1319`)
- Bars on a DPR-scaled `<canvas>` (~600 peaks; bar width ≈62% of slot, height = `peak*0.86*H`, min 1.5).
- **Loop-region coloring:** bars whose center time is within `[loopA,loopB]` are painted the **track accent**; all others `#39414f`. Redraw on any A/B change, loop select/add, track change, resize.
- Region overlay `rgba(94,234,212,.09)` with teal side borders `rgba(94,234,212,.55)`; area outside A–B dimmed `rgba(6,8,11,.5)`.
- Draggable **A / B** handles (2px teal line + labeled tab, `ew-resize`, `touch-action:none`). Amber **playhead** (2px `#ffb454`, glow, top dot). Click anywhere seeks.
- Ruler below: 7 evenly-spaced ticks with `m:ss` labels (10px `#5b6472`).

### LOOPS strip (`padding:15px 26px 0`)
- Left: “LOOPS” eyebrow + “N loops” count. Horizontally-scrolling row of **loop pills**, ordered **by start time ascending**:
  - Pill (height 40, radius 10): active `rgba(94,234,212,.12)` + border `rgba(94,234,212,.5)`, else `#14171d`. 7px dot (active = accent). **Editable name** input (inline rename). Mono `m:ss – m:ss` range. **×** remove (hover `#f87171`).
  - Click selects the loop (sets active, seeks to its start). Never remove the last loop; removing active selects the first remaining.
- **+ Add loop** button (dashed teal): creates a loop at the playhead (`a=playhead`, `b=a+clamp(2..8, duration*0.12)`), names “Loop N”, selects it.

### Loop readout + trim (`padding:12px 26px 0`)
- Panel with three cells: **LOOP START** / **LOOP END** — each a **− / + nudge** (±10ms) around an **editable time field** (accepts `m:ss.mmm`, `ss.mmm`, or seconds; Enter commits, Escape reverts, invalid reverts, out-of-range clamps). **LENGTH** = `loopB − loopA`.
- **Set A here** / **Set B here** buttons set the point to the playhead.

### Transport (`padding:14px 26px 18px`, wrap, gap 18, `margin-top:auto`)
- **Prev / Play / Next**: prev+next 40×40 (`#14171d`); Play 54×54 radius 14, teal gradient, `#04231f` icon, shadow. Prev/Next move between **songs**.
- **Time**: mono 19px current `m:ss.mmm` + `/ m:ss` total.
- **Loop toggle** (default ON): on = teal fill; off = `#14171d`. When on, playback repeats A→B **infinitely**; off plays to the end and stops. (No repeat count, no play-count readout.)
- **Speed**: panel with clock glyph + **SPEED** label + range slider (`min .25 max 1.5 step .05`, accent teal) + **editable value field** (type 0.25–1.50, Enter commits, synced with slider) + “×” + **1×** reset. **Pitch preserved** (`preservesPitch=true`; YouTube snaps to nearest of `[0.25,0.5,0.75,1,1.25,1.5]`).

### Accounts (top-right)
- **Signed out:** teal **Sign in** button (user glyph).
- **Auth modal:** toggles **Create account** / **Sign in** — email + password (prototype: any valid email + 4+ char password). Copy: “Save your loops and open them on any device. It's free.”
- **Signed in:** a **SYNCED** chip (teal dot + label) with the user's **initials** avatar; dropdown shows email, sync status, **Sign out** (closes on outside click).
- **Import prompt:** if the user has guest loops when they sign in, ask whether to add them to the account — **Import** merges guest + account library; **Don't import** keeps only the account's saved library. Grammar adapts to 1 vs N tracks.
- **Persistence (prototype):** account in `localStorage['looptree_account']`; library per account in `localStorage['looptree_lib_<email>']` (saved on any track change, restored on load). Object URLs for local files are **not** serialized — after reload, file tracks restore loops/metadata but need re-upload to play (video panel hides until then); YouTube tracks fully restore.

### Shortcuts overlay (modal)
Two-column grid of label + keycap. Keys (ignored while typing in inputs): **Space** play/pause · **L** toggle loop · **A/B** set loop start/end at playhead · **Q/W** trim start −/+10ms · **O/P** trim end −/+10ms · **←/→** seek −/+5s · **↑/↓** speed +/−5% · **< / >** prev/next song · **[ / ]** prev/next loop · **N** add loop · **1×** reset speed.

---

## Playback engine (port the approach)
- A `requestAnimationFrame` tick runs while playing; each frame reads current time and, if loop is on and `t≥loopB`, seeks back to `loopA` (infinite repeat); if loop off and past the end, stops.
- **Single clock source per track** → the playhead, time readout, and video are always in sync:
  - **YouTube:** IFrame API player (`controls:0,disablekb:1,modestbranding:1,rel:0,playsinline:1,fs:0`), `width/height:'100%'`. Read time via `getCurrentTime()`, seek via `seekTo(t,true)`; discrete rates only (snap to nearest). Read real duration on ready/state-change and clamp loops.
  - **Local file/video:** `<video>` element; time via `currentTime`, `playbackRate` + `preservesPitch`. `loadedmetadata` patches real duration when `decodeAudioData` couldn't (video containers).
- **Waveform peaks:** decode file via Web Audio `decodeAudioData` → 600 max-abs buckets; on failure (e.g., video container) fall back to synthetic peaks and read duration from the media element.
- Pressing **play** when the playhead is outside the active loop snaps it to `loopA` first.

## State model
Per-app: `tracks[]`, `currentId`, `search`, `ytUrl`, `playing`, `rate`(0.25–1.5), `loopEnabled`(default true), `newTag`, `narrow`, `sidebarOpen`, `videoWidth`, plus account/auth (`account`, `authOpen`, `authMode`, `authEmail`, `authPass`, `authError`, `accountMenuOpen`, `importOpen`). Non-render refs: virtual time `vt`, RAF handle, YouTube player + ready flag, `_manualVideo`, pending guest/saved libraries.

```ts
type Loop  = { id:string; name:string; a:number; b:number };   // seconds
type Track = {
  id:string; kind:'file'|'youtube'; hasVideo?:boolean;
  title:string; artist:string; tags:string[];
  duration:number; loops:Loop[]; activeLoopId:string;   // loops always ≥1, kept sorted by a
  accent:string; peaks?:number[]; thumb?:string; url?:string; videoId?:string;
};
```
Active loop = `track.loops.find(l=>l.id===track.activeLoopId)`. All A/B/length UI reads & writes go through it. Editing a loop's start re-sorts the song's loops.

---

## Design tokens
**Colors** — app bg `#0c0e12`; panels `#0e1116`/`#0f1319`; inputs `#14171d`/`#161a21`; borders `rgba(255,255,255,.07–.1)`. Text: `#e7eaf0`/`#fff` primary; `#c3c9d4`/`#b8bfca`/`#d5dae2` secondary; `#8a92a2`/`#7b8494`/`#6b7280`/`#5b6472`/`#4b5563` muted. **Accent** teal `#5eead4`, gradient `#2dd4bf→#0ea5a4`, teal-on-dark text `#052e2b`/`#04231f`. Waveform gray `#39414f`; playhead amber `#ffb454`. Source accents: youtube `#fca5a5`, audio file `#93c5fd`, video file `#c4b5fd`. Danger `#f87171` on `rgba(248,113,113,.1–.12)`.
**Type** — UI: **Space Grotesk** (400–700). Numbers/time: **JetBrains Mono** (`.tno` tabular-nums) for all time readouts, ranges, counts, speed. Sizes: 30 hero, 21 title, 19 transport time, 16 A/B fields, 15 speed, 13 body, 12.5 buttons, 11 labels, 9.5–10 eyebrows (.1em).
**Radius** 6–16px per component. **Shadows**: play `0 4px 18px rgba(45,212,191,.4)`; modals `0 24px 70px rgba(0,0,0,.6)`; video `0 8px 30px rgba(0,0,0,.4)`; playhead glow `0 0 8px rgba(255,180,84,.6)`. Scrollbar 10px thumb `#242a34` (hover `#2f3742`).

## Assets
- Fonts: Space Grotesk + JetBrains Mono (Google Fonts) — swap to codebase equivalents if standardized.
- Icons: inline SVG throughout (menu, YouTube, upload, keyboard, search, music note, play/pause/prev/next, loop, clock, plus, close, user, sign-out, import). Replace with the codebase's icon set.
- Thumbnails: YouTube `img.youtube.com/vi/<id>/mqdefault.jpg`; audio/video files use a note-glyph placeholder.
- No raster assets bundled.

## Files
- `multi-looper.dc.html` — complete hi-fi prototype (all states, styling, and working audio/video/loop/account logic). Open in a browser to interact; read the source for exact values and the playback/looping/auto-fit implementation.
