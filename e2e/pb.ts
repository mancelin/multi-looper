import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const PB_URL = "http://127.0.0.1:8090";

/**
 * Email for a throwaway e2e account. The `e2e-` prefix is what
 * `teardown.ts` matches on when it deletes the accounts after the run.
 */
export function e2eEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}@example.com`;
}

/**
 * Opens the auth modal (it starts in signup mode), switches to sign-in and
 * submits the credentials. Signup closes the modal, so this is how every
 * test signs in after creating an account.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByTitle("Sign in").click();
  await page.getByTestId("auth-mode-toggle").click();
  await expect(page.getByText("Welcome back")).toBeVisible();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByPlaceholder("Password").press("Enter");
}

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

/**
 * Flags a user as premium (1 GB quota) straight in SQLite — stands in for an
 * admin flipping the field in the PB dashboard.
 */
export function setPremium(email: string): void {
  const db = path.resolve(__dirname, "../pb/pb_data/data.db");
  const script = [
    "import sqlite3, sys",
    "con = sqlite3.connect(sys.argv[1])",
    'con.execute("UPDATE users SET premium = 1 WHERE email = ?", (sys.argv[2],))',
    "con.commit()",
  ].join("\n");
  execFileSync("python3", ["-c", script, db, email]);
}

/** Total synced media bytes for a user, read straight from SQLite. */
export function userMediaSize(email: string): number {
  const db = path.resolve(__dirname, "../pb/pb_data/data.db");
  const script = [
    "import sqlite3, sys",
    "con = sqlite3.connect(sys.argv[1])",
    'row = con.execute("SELECT COALESCE(SUM(t.mediaSize), 0) FROM tracks t JOIN users u ON t.user = u.id WHERE u.email = ?", (sys.argv[2],)).fetchone()',
    "print(row[0])",
  ].join("\n");
  return Number(execFileSync("python3", ["-c", script, db, email]).toString().trim());
}
