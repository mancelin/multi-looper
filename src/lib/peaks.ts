export const PEAK_COUNT = 600;

/** Fallback when decodeAudioData fails (e.g. some video containers). */
export function syntheticFilePeaks(n = PEAK_COUNT): number[] {
  return Array.from({ length: n }, (_, i) => 0.1 + 0.6 * Math.abs(Math.sin(i / 9)));
}

export interface DecodedPeaks {
  peaks: number[];
  /** 0 when decoding failed — caller should patch duration from the media element */
  duration: number;
}

export async function decodePeaks(file: File): Promise<DecodedPeaks> {
  try {
    const ac = new AudioContext();
    try {
      const buf = await file.arrayBuffer();
      const ab = await ac.decodeAudioData(buf);
      const ch = ab.getChannelData(0);
      const n = PEAK_COUNT;
      const block = Math.floor(ch.length / n);
      const peaks: number[] = [];
      for (let i = 0; i < n; i++) {
        let mx = 0;
        for (let j = 0; j < block; j++) {
          const v = Math.abs(ch[i * block + j] || 0);
          if (v > mx) mx = v;
        }
        peaks.push(Math.max(0.04, Math.min(1, mx * 1.25)));
      }
      return { peaks, duration: ab.duration };
    } finally {
      void ac.close().catch(() => {});
    }
  } catch {
    return { peaks: syntheticFilePeaks(), duration: 0 };
  }
}
