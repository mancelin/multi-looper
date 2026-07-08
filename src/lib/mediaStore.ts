/**
 * IndexedDB store for the media blobs of file tracks, keyed by track id.
 * localStorage can't hold audio/video, so guest file tracks persist here and
 * get re-attached (object URL + file registry) on boot. Best-effort: every
 * operation swallows storage errors — the app still works for the session.
 */

const DB_NAME = "multilooper";
const STORE = "media";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
  return dbPromise;
}

function inStore<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
      }),
  );
}

export async function putMedia(trackId: string, file: File): Promise<void> {
  try {
    await inStore("readwrite", (s) => s.put(file, trackId));
  } catch {
    // quota exceeded / storage unavailable
  }
}

export async function getMedia(trackId: string): Promise<File | undefined> {
  try {
    return (await inStore("readonly", (s) => s.get(trackId))) as File | undefined;
  } catch {
    return undefined;
  }
}

export async function deleteMedia(trackId: string): Promise<void> {
  try {
    await inStore("readwrite", (s) => s.delete(trackId));
  } catch {
    // ignore
  }
}

/** Drop blobs whose track no longer exists in the guest library. */
export async function pruneMedia(keepIds: ReadonlySet<string>): Promise<void> {
  try {
    const keys = (await inStore("readonly", (s) => s.getAllKeys())) as string[];
    await Promise.all(keys.filter((k) => !keepIds.has(k)).map((k) => deleteMedia(k)));
  } catch {
    // ignore
  }
}
