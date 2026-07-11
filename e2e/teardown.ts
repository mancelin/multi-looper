import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Global teardown: delete the throwaway PocketBase accounts the e2e suite
 * signed up (emails from `e2eEmail()` in pb.ts), plus their track records
 * and uploaded media files. Works straight on the SQLite file, same as the
 * other pb.ts helpers — dev PB has no superuser credentials to use the API.
 */
export default function teardown(): void {
  const db = path.resolve(__dirname, "../pb/pb_data/data.db");
  if (!existsSync(db)) return; // suite ran without PocketBase

  const script = `
import pathlib
import shutil
import sqlite3
import sys

db = sys.argv[1]
con = sqlite3.connect(db)
row = con.execute("SELECT id FROM _collections WHERE name = 'tracks'").fetchone()
tracks_col = row[0] if row else None
storage = pathlib.Path(db).parent / "storage"

users = [
    r[0]
    for r in con.execute(
        "SELECT id FROM users WHERE email LIKE 'e2e-%@example.com'"
    )
]
deleted_tracks = 0
for uid in users:
    track_ids = [r[0] for r in con.execute("SELECT id FROM tracks WHERE user = ?", (uid,))]
    for tid in track_ids:
        if tracks_col:
            shutil.rmtree(storage / tracks_col / tid, ignore_errors=True)
    con.execute("DELETE FROM tracks WHERE user = ?", (uid,))
    deleted_tracks += len(track_ids)
    con.execute("DELETE FROM users WHERE id = ?", (uid,))
con.commit()
print(f"e2e teardown: removed {len(users)} account(s), {deleted_tracks} track(s)")
`;
  const out = execFileSync("python3", ["-c", script, db]).toString().trim();
  if (!out.startsWith("e2e teardown: removed 0 ")) console.log(out);
}
