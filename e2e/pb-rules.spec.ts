import { type APIRequestContext, expect, test } from "@playwright/test";
import { e2eEmail, PB_URL, pbAvailable, verifyUser } from "./pb";

const PASSWORD = "password123";
const TRACKS = `${PB_URL}/api/collections/tracks/records`;

/** Creates a verified account straight through the API and signs it in. */
async function account(request: APIRequestContext, prefix: string) {
  const email = e2eEmail(prefix);
  const created = await request.post(`${PB_URL}/api/collections/users/records`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD },
  });
  expect(created.ok()).toBe(true);
  verifyUser(email);
  const auth = await request.post(`${PB_URL}/api/collections/users/auth-with-password`, {
    data: { identity: email, password: PASSWORD },
  });
  expect(auth.ok()).toBe(true);
  const body = await auth.json();
  return { id: body.record.id as string, headers: { Authorization: body.token as string } };
}

function trackBody(user: string, extra: Record<string, unknown> = {}) {
  return {
    user,
    kind: "youtube",
    videoId: "dQw4w9WgXcQ",
    title: "t",
    duration: 10,
    loops: [{ id: "l", name: "Loop", a: 0, b: 10 }],
    ...extra,
  };
}

test("a track can't be moved into another user's library", async ({ request }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");

  const owner = await account(request, "owner");
  const victim = await account(request, "victim");
  const created = await request.post(TRACKS, {
    headers: owner.headers,
    data: trackBody(owner.id),
  });
  expect(created.ok()).toBe(true);
  const track = await created.json();

  // reassigning the owner is refused
  const moved = await request.patch(`${TRACKS}/${track.id}`, {
    headers: owner.headers,
    data: { user: victim.id },
  });
  expect(moved.ok()).toBe(false);

  // the victim's library stays empty, the owner keeps the track
  const victimList = await (await request.get(TRACKS, { headers: victim.headers })).json();
  expect(victimList.totalItems).toBe(0);
  const kept = await (await request.get(`${TRACKS}/${track.id}`, { headers: owner.headers })).json();
  expect(kept.user).toBe(owner.id);

  // normal edits, and restating yourself as owner, still go through
  const edited = await request.patch(`${TRACKS}/${track.id}`, {
    headers: owner.headers,
    data: { title: "renamed", user: owner.id },
  });
  expect(edited.ok()).toBe(true);
});

test("track text and JSON count toward the storage quota", async ({ request }) => {
  test.skip(!(await pbAvailable()), "PocketBase not running (just pb-up)");
  test.setTimeout(120_000);

  const user = await account(request, "bloat");
  // ~3.7 MB of JSON per file-less record: peaks + extra media notes, each
  // just under its field's 2 MB cap
  const peaks = Array.from({ length: 150_000 }, () => 0.123456789);
  const notes = [{ start: 0, end: 10, media: { type: "markdown", text: "x".repeat(1_900_000) } }];

  let stored = 0;
  let refusal = "";
  for (let i = 0; i < 20 && !refusal; i++) {
    const res = await request.post(TRACKS, {
      headers: user.headers,
      data: trackBody(user.id, { peaks, extraMedia: notes }),
    });
    if (res.ok()) {
      const rec = await res.json();
      // the server-owned size counts the JSON even though there is no file
      expect(rec.mediaSize).toBeGreaterThan(3_500_000);
      stored += rec.mediaSize;
    } else {
      const body = await res.json();
      refusal = `${body.message} ${JSON.stringify(body.data)}`;
    }
  }

  expect(refusal).toMatch(/^Storage limit reached \(20 MB per account\)/);
  expect(stored).toBeLessThanOrEqual(20 * 1024 * 1024);
});
