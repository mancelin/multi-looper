import PocketBase from "pocketbase";

export const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";

export const pb = new PocketBase(PB_URL);

// The app manages concurrent saves itself (debounced queue); PB's built-in
// auto-cancellation would otherwise abort in-flight uploads.
pb.autoCancellation(false);
