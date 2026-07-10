// Mirrors the server-side default in pb/pb_hooks/quota.js (MAX_USER_DATA_BYTES env).
export const MAX_USER_DATA_BYTES = 20 * 1024 * 1024;

/** Bytes → MB label: one decimal under 10 MB, whole numbers above. */
export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : String(Math.round(mb * 10) / 10);
}
