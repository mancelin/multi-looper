# Changelog

## v1.6 (2026-09-29)

### Features
- Deleting an extra media segment now removes its media too, and a track can hold at most one empty segment at a time

### Fixes
- A track's owner can no longer be reassigned
- The storage quota now counts all of a track's data (media file plus every text/JSON field), not just the media file

### Docs
- Logo next to the README title, links to `just`, obsolete references removed from comments

## v1.5 (2026-09-29)

### Features
- Open-sourced under AGPL, with contributors credited
- The total number of accounts is capped (`MAX_USERS`, default 6000). When sign-ups are closed, the app points new users to guest mode

### Fixes
- The extra media panel works on phones
- The deploy host is read from `DEPLOY_HOST` in `.env`

## v1.4 (2026-09-15)

### Features
- **Extra media**: every track (YouTube, file, recording) can show a cover image or markdown notes above the video
- **Timed extra media**: split a track into segments, each with its own image or notes, shown as the playhead passes. Drag shared edges to retime them, "Add at playhead" to split one
- Removing extra media asks for confirmation first
- Clear button in the library search field
- Full-width extra media buttons

### Fixes
- Removed the gap between the waveform and the transport
- Notes get the same box height as images

## v1.3 (2026-08-30)

### Features
- The toolbar's add actions (YouTube, file, record) are grouped into a single "+" sheet

### Dev
- `just set-version` recipe, which also commits the version files and tags the release

## v1.2 (2026-08-23)

### Features
- **Record from the microphone**: mic takes become regular audio tracks with a `REC` tag
- Reorder the library by drag and drop
- Removing a track asks for confirmation first

### Fixes
- Recorded takes behave like file tracks: seekable on Firefox (ogg/opus) and keep their exact duration
- No mic-open beep/pop in takes: the mic opens with the dialog and stays open across takes

### Dev
- Deploy-and-migrate release recipe

## v1.1 (2026-08-05)

### Features
- Undo/redo for loop A/B edits
- `R` plays from the loop start
- Typing a loop end with no loop set spans 10s
- Setting a loop end turns loop mode on
- Rename tracks, volume control
- The YouTube player's own controls are hidden, and tracks use the real video title
- Hint to add a cover image on file tracks
- 1 GB media quota for premium users
- Share links for YouTube loops
- Email verification is confirmed inside the app via the `?verify` link
- Copyright notice in App info

### Fixes
- The playhead holds on the seek target until the seek lands
- The playhead lands on loop A after switching tracks
- A/B markers no longer drift on play or loop wrap
- A/B badges stay inside the strip and apart from each other
- Setting A or B refuses a value that would cross the other marker
- A new YouTube track no longer takes the previous track's title
- The paused YouTube frame stays visible
- YouTube captions stay off, and the center control is hidden on Firefox
- YouTube autoplay fix
- Unknown routes return 404
- The hero logo stays visible on small screens

## v1.0 (2026-07-10)

First release.

- Loop A/B sections of YouTube videos or local audio/video files, with slowdown
- Resizable cover image on file tracks (drop/paste), remembered per track
- Selected track number mirrored in the URL
- Accounts: email sign-up with required verification, Google sign-in, and library sync via PocketBase
- Guest mode with local storage. Signing out wipes local data
- Settings modal with account and legal info
- 20 MB per-user media quota, with a storage usage bar in the account menu
- Errors shown as toasts
- Android app via Capacitor, with app icon and favicon
