// Mirrors the server-side defaults in pb/pb_hooks/quota.js
// (MAX_USER_DATA_BYTES / MAX_PREMIUM_DATA_BYTES envs).
export const MAX_USER_DATA_BYTES = 20 * 1024 * 1024;
export const MAX_PREMIUM_DATA_BYTES = 1024 * 1024 * 1024;

export function quotaFor(premium: boolean): number {
  return premium ? MAX_PREMIUM_DATA_BYTES : MAX_USER_DATA_BYTES;
}

/** Bytes → MB label: one decimal under 10 MB, whole numbers above. */
export function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : String(Math.round(mb * 10) / 10);
}

/** Quota label with unit: "20 MB", "1 GB". */
export function formatLimit(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${Math.round(gb * 10) / 10} GB` : `${formatMB(bytes)} MB`;
}
