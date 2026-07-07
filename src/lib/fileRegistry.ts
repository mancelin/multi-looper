/**
 * In-memory registry of the original File objects for tracks added this session.
 * Object URLs and Files are not serializable; the sync layer reads from here
 * when uploading media to PocketBase after sign-in.
 */
const files = new Map<string, File>();

export function registerFile(trackId: string, file: File): void {
  files.set(trackId, file);
}

export function getFile(trackId: string): File | undefined {
  return files.get(trackId);
}

export function releaseFile(trackId: string): void {
  files.delete(trackId);
}
