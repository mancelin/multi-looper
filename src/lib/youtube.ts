export function extractVideoId(input: string): string | null {
  const u = input.trim();
  if (!u) return null;
  const m =
    u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/) ??
    u.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

export function thumbUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/** Synthetic waveform for YouTube tracks (no audio data available client-side). */
export function syntheticYtPeaks(videoId: string, n = 600): number[] {
  return Array.from({ length: n }, (_, i) => {
    const x = i / n;
    return Math.max(
      0.06,
      Math.min(
        1,
        (0.3 + 0.7 * Math.abs(Math.sin(i / 7 + videoId.length))) *
          Math.min(1, Math.sin(x * Math.PI) * 1.3 + 0.2),
      ),
    );
  });
}
