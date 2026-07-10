"use client";

import { APP_NAME, APP_VERSION } from "@/lib/appInfo";
import type { Track } from "@/lib/types";

/**
 * "Download my data" export: everything the app stores about the user as one
 * JSON file — account email (when signed in) plus the full library (track
 * metadata and loop positions). Media blobs are not embedded; the export
 * notes that they live on the user's device / in their PB storage.
 */

export interface DataExport {
  app: string;
  version: string;
  exportedAt: string;
  account: { id: string; email: string } | null;
  note: string;
  tracks: Track[];
}

/** Strip runtime-only fields (object URLs) before serializing. */
function serializable(tracks: Track[]): Track[] {
  return tracks.map((t) => {
    const copy: Track = { ...t };
    if (copy.url?.startsWith("blob:")) delete copy.url;
    return copy;
  });
}

export function buildDataExport(
  tracks: Track[],
  account: { id: string; email: string } | null,
): DataExport {
  return {
    app: APP_NAME,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    account,
    note: "Media files are not embedded: local files stay on your device; synced uploads are reachable via each track's url.",
    tracks: serializable(tracks),
  };
}

/** Trigger a browser download of the export as a JSON file. */
export function downloadDataExport(data: DataExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `multi-looper-data-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
