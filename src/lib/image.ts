"use client";

const MAX_DIM = 1280;

/**
 * Decode an image file into a data URL, downscaled to MAX_DIM on the longest
 * side and re-encoded as JPEG so it stays small enough for localStorage and
 * the PocketBase text field.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

/** First image file in a drop / paste payload, if any. */
export function firstImageFile(dt: DataTransfer | null): File | undefined {
  if (!dt) return undefined;
  return [...dt.files].find((f) => f.type.startsWith("image/"));
}
