"use client";

import { activeLoop, type Track } from "@/lib/types";
import { YT_PLACEHOLDER_TITLE } from "@/lib/youtube";
import { currentTrack, useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

/* Minimal YouTube IFrame API surface used by the controller. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  getPlayerState(): number;
  /** Undocumented but long-stable: metadata of the loaded/cued video. */
  getVideoData?(): { title?: string } | undefined;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

export function nearestYtRate(r: number): number {
  return YT_RATES.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a), 1);
}

type TimeListener = (t: number, duration: number) => void;

/**
 * Single clock source per track (prototype approach): a rAF tick reads the
 * current media time and enforces the A→B loop; the playhead / time readout
 * update imperatively through registered listeners so React never re-renders
 * at frame rate.
 */
class PlaybackController {
  private videoEl: HTMLVideoElement | null = null;
  private ytHost: HTMLElement | null = null;
  private yt: YTPlayer | null = null;
  private ytReady = false;
  private ytPendingPlay = false;
  private ytTrackId: string | null = null;

  /** virtual time fallback while no media is ready */
  private vt = 0;
  /** when the last seek was issued — backends apply seeks asynchronously */
  private seekIssuedAt = 0;
  /** true from seek issue until the media time lands near the target */
  private seekPending = false;
  private raf: number | null = null;
  private listeners = new Set<TimeListener>();

  // ---------- registration ----------

  setVideoEl(el: HTMLVideoElement | null): void {
    this.videoEl = el;
  }

  setYtHost(el: HTMLElement | null): void {
    if (el === this.ytHost) return;
    this.ytHost = el;
    if (!el && this.yt) {
      try {
        this.yt.destroy();
      } catch {}
      this.yt = null;
      this.ytReady = false;
      this.ytTrackId = null;
      useUi.getState().setYtSurfaceLive(false);
    }
  }

  onTime(fn: TimeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- clock ----------

  private track(): Track | undefined {
    return currentTrack(useLibrary.getState());
  }

  private duration(): number {
    return this.track()?.duration || 1;
  }

  getT(): number {
    const c = this.track();
    if (!c) return 0;
    if (c.kind === "youtube" && this.yt && this.ytReady) {
      try {
        return this.yt.getCurrentTime() || 0;
      } catch {
        return this.vt;
      }
    }
    if (c.kind === "file" && this.videoEl) return this.videoEl.currentTime || 0;
    return this.vt;
  }

  setT(t: number): void {
    const c = this.track();
    t = Math.max(0, Math.min(this.duration(), t));
    if (c?.kind === "youtube" && this.yt && this.ytReady) {
      try {
        // seekTo on a cued/unstarted video autostarts playback (IFrame API
        // behavior); while the transport is paused, re-cue at the target
        // instead so the video stays stopped.
        const s = this.ytState();
        if (!useUi.getState().playing && (s === 5 || s === -1)) {
          this.yt.cueVideoById(c.videoId!, t);
        } else {
          this.yt.seekTo(t, true);
        }
      } catch {}
    } else if (c?.kind === "file" && this.videoEl) {
      this.videoEl.currentTime = t;
    }
    this.vt = t;
    this.seekIssuedAt = performance.now();
    this.seekPending = true;
    // Emit the requested target, not getT(): the backend applies the seek
    // asynchronously and would still report the pre-seek time here. While
    // paused no tick runs, so a stale emit would stick until the next seek.
    this.emit(t);
  }

  seekBy(delta: number): void {
    // getT() can still report the pre-seek media time right after setT()
    // (YouTube's seekTo is async). While paused the media time only changes
    // through setT(), so vt is authoritative; same while a seek is in
    // flight (covers rapid consecutive seeks).
    const paused = !useUi.getState().playing;
    this.setT((paused || this.seekPending ? this.vt : this.getT()) + delta);
  }

  /** Current IFrame player state, or -2 when unavailable. */
  private ytState(): number {
    if (!this.yt || !this.ytReady) return -2;
    try {
      return this.yt.getPlayerState();
    } catch {
      return -2;
    }
  }

  private emit(t = this.getT()): void {
    const d = this.duration();
    for (const fn of this.listeners) fn(t, d);
  }

  // ---------- tick ----------

  private startTick(): void {
    if (this.raf != null) return;
    const step = () => {
      this.frame();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private stopTick(): void {
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  private frame(): void {
    const c = this.track();
    if (!c) return;
    const raw = this.getT();
    // Backends apply seeks asynchronously: until the media time lands near
    // the seek target the backend still reports the pre-seek time (a cued
    // YouTube video even needs to load/buffer first, which can take a
    // while). Report the target (vt) meanwhile so the playhead doesn't
    // flash the stale position; a time cap guards against a seek that
    // silently never lands.
    if (this.seekPending) {
      const near = Math.abs(raw - this.vt) <= 0.5;
      // YouTube: a cued video reports its cue point (then transiently 0
      // while loading) before playback truly starts — only trust the media
      // time once the player is actually playing.
      const landed = c.kind === "youtube" ? near && this.ytState() === 1 : near;
      if (landed || performance.now() - this.seekIssuedAt > 5000) this.seekPending = false;
    }
    const t = this.seekPending ? this.vt : raw;
    const d = this.duration();
    const lp = activeLoop(c);
    const { loopEnabled } = useUi.getState();
    if (loopEnabled && t >= lp.b) {
      this.setT(lp.a);
      return;
    }
    if (!loopEnabled && t >= d) {
      this.setT(0);
      this.pause();
      return;
    }
    this.emit(t);
  }

  // ---------- transport ----------

  play(): void {
    const c = this.track();
    if (!c) return;
    const lp = activeLoop(c);
    // while a seek is in flight the media still reports the pre-seek time
    const t = this.seekPending ? this.vt : this.getT();
    const { rate, loopEnabled } = useUi.getState();
    // flip the transport state first: the YouTube state-change guard pauses
    // any playback that starts while the transport says paused
    useUi.getState().setPlaying(true);
    if (loopEnabled) {
      if (t >= lp.b - 0.01 || t < lp.a - 0.001) this.setT(lp.a);
    } else if (t >= this.duration() - 0.01) {
      this.setT(0);
    }
    if (c.kind === "youtube") {
      if (this.yt && this.ytReady) {
        try {
          this.yt.setPlaybackRate(nearestYtRate(rate));
          this.yt.playVideo();
        } catch {}
      } else {
        this.ytPendingPlay = true;
        this.ensureYt(c);
      }
    } else if (c.kind === "file" && this.videoEl) {
      this.videoEl.playbackRate = rate;
      this.videoEl.preservesPitch = true;
      void this.videoEl.play().catch(() => {});
    }
    this.startTick();
  }

  pause(): void {
    const c = this.track();
    if (c?.kind === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.pauseVideo();
      } catch {}
    }
    if (c?.kind === "file") this.videoEl?.pause();
    useUi.getState().setPlaying(false);
    this.stopTick();
    // sync vt so paused seeks (which trust vt) start from where playback
    // stopped — unless a seek is still in flight, then vt (the target) is
    // the truth and the media still reports the stale pre-seek time
    if (!this.seekPending) this.vt = this.getT();
    this.emit(this.vt);
  }

  togglePlay(): void {
    if (useUi.getState().playing) this.pause();
    else this.play();
  }

  applyRate(r: number): void {
    if (!isFinite(r)) return;
    r = Math.max(0.25, Math.min(1.5, r));
    useUi.getState().setRate(r);
    const c = this.track();
    if (c?.kind === "file" && this.videoEl) {
      this.videoEl.playbackRate = r;
      this.videoEl.preservesPitch = true;
    }
    if (c?.kind === "youtube" && this.yt && this.ytReady) {
      try {
        this.yt.setPlaybackRate(nearestYtRate(r));
      } catch {}
    }
  }

  bumpRate(delta: number): void {
    this.applyRate(Math.round((useUi.getState().rate + delta) * 100) / 100);
  }

  // ---------- track switching ----------

  private pendingAutoplay = false;

  /**
   * Wire the media layer to the (already selected) current track.
   * Called by PlayerMain's effect once the media elements are mounted;
   * autoplay carries over from advance() via the pending flag.
   */
  loadCurrent(): void {
    const c = this.track();
    if (!c) return;
    const autoplay = this.pendingAutoplay;
    this.pendingAutoplay = false;
    this.vt = 0;
    if (this.videoEl) {
      if (c.kind === "file" && c.url) {
        if (this.videoEl.getAttribute("src") !== c.url) this.videoEl.src = c.url;
      } else {
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
      }
    }
    if (c.kind === "youtube") {
      this.ytPendingPlay = autoplay;
      this.ensureYt(c);
    } else if (this.yt && this.ytReady) {
      try {
        this.yt.stopVideo();
      } catch {}
    }
    const lp = activeLoop(c);
    this.setT(lp.a);
    if (autoplay && c.kind !== "youtube") this.play();
  }

  selectTrack(id: string): void {
    const lib = useLibrary.getState();
    if (id === lib.currentId) return;
    this.pause();
    this.pendingAutoplay = false;
    lib.selectTrack(id);
  }

  advance(dir: 1 | -1): void {
    const lib = useLibrary.getState();
    const list = lib.tracks;
    if (!list.length) return;
    const autoplay = useUi.getState().playing;
    const i = list.findIndex((t) => t.id === lib.currentId);
    const next = list[(i + dir + list.length) % list.length];
    this.pause();
    this.pendingAutoplay = autoplay;
    lib.selectTrack(next.id);
  }

  /** Called after removing the current track (store already reselected). */
  afterRemoval(): void {
    this.pause();
    this.pendingAutoplay = false;
  }

  // ---------- YouTube ----------

  static loadApi(): void {
    if (typeof window === "undefined" || window.YT) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }

  private ensureYt(c: Track): void {
    if (!this.ytHost || !c.videoId) return;
    PlaybackController.loadApi();
    const boot = () => {
      if (!window.YT?.Player) {
        setTimeout(boot, 200);
        return;
      }
      if (!this.yt) {
        const mount = document.createElement("div");
        this.ytHost!.innerHTML = "";
        this.ytHost!.appendChild(mount);
        this.ytTrackId = c.id;
        this.yt = new window.YT.Player(mount, {
          width: "100%",
          height: "100%",
          videoId: c.videoId!,
          playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 0 },
          events: {
            onReady: () => {
              this.ytReady = true;
              this.patchYtDuration();
              this.patchYtTitle();
              if (this.ytPendingPlay) {
                this.ytPendingPlay = false;
                this.play();
              }
            },
            onStateChange: (e) => {
              this.ytReady = true;
              // playing(1)/buffering(3) count as live so the poster cover
              // doesn't flash on loop seeks; every other state (cued, paused,
              // ended, unstarted) re-covers YouTube's overlay UI
              useUi.getState().setYtSurfaceLive(e.data === 1 || e.data === 3);
              this.patchYtTitle();
              if (e.data === 1) {
                this.patchYtDuration();
                // last-resort guard: the IFrame API autostarts in flows we
                // can't fully suppress; if the transport says paused, stop it
                if (!useUi.getState().playing && !this.ytPendingPlay) {
                  try {
                    this.yt?.pauseVideo();
                  } catch {}
                }
              }
            },
          },
        });
      } else if (this.ytTrackId !== c.id) {
        this.ytTrackId = c.id;
        useUi.getState().setYtSurfaceLive(false); // new video: re-cover until it plays
        try {
          // loadVideoById always autostarts; when we're not meant to play,
          // cue instead — it loads the video without starting playback.
          if (this.ytPendingPlay) this.yt.loadVideoById(c.videoId!);
          else this.yt.cueVideoById(c.videoId!, activeLoop(c).a);
        } catch {}
        if (this.ytPendingPlay) {
          this.ytPendingPlay = false;
          this.play();
        }
      } else if (this.ytPendingPlay && this.ytReady) {
        this.ytPendingPlay = false;
        this.play();
      }
      // else: player exists but onReady hasn't fired yet — leave ytPendingPlay
      // set; onReady consumes it. Calling play() here would recurse forever.
    };
    boot();
  }

  /** Replaces the ingest placeholder title with the real video title. */
  private patchYtTitle(): void {
    const c = this.track();
    if (!c || c.kind !== "youtube" || c.id !== this.ytTrackId || !this.yt) return;
    if (c.title !== YT_PLACEHOLDER_TITLE) return; // user already renamed it
    try {
      const title = this.yt.getVideoData?.()?.title?.trim();
      if (title) useLibrary.getState().patchTrack(c.id, { title });
    } catch {}
  }

  private patchYtDuration(): void {
    const c = this.track();
    if (!c || c.kind !== "youtube" || !this.yt) return;
    try {
      const d = this.yt.getDuration();
      if (d > 0 && Math.abs(d - c.duration) > 0.5) useLibrary.getState().patchDuration(c.id, d);
    } catch {}
  }

  /** <video> loadedmetadata — patches duration when decodeAudioData couldn't. */
  onLoadedMetadata(): void {
    const c = this.track();
    if (!c || c.kind !== "file" || !this.videoEl) return;
    const d = this.videoEl.duration;
    if (isFinite(d) && d > 0 && Math.abs(d - c.duration) > 0.5) {
      useLibrary.getState().patchDuration(c.id, d);
    }
  }
}

export const player = new PlaybackController();
