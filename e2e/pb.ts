import { execFileSync } from "node:child_process";
import path from "node:path";

export const PB_URL = "http://127.0.0.1:8090";

/** True when the optional PocketBase backend is up (`just pb-up`). */
export async function pbAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Marks a user as verified by writing straight into the local PocketBase
 * SQLite file (bind-mounted at pb/pb_data). Dev has no mail server, so the
 * verification link can never be clicked — this stands in for it.
 */
export function verifyUser(email: string): void {
  const db = path.resolve(__dirname, "../pb/pb_data/data.db");
  const script = [
    "import sqlite3, sys",
    "con = sqlite3.connect(sys.argv[1])",
    'con.execute("UPDATE users SET verified = 1 WHERE email = ?", (sys.argv[2],))',
    "con.commit()",
  ].join("\n");
  execFileSync("python3", ["-c", script, db, email]);
}
