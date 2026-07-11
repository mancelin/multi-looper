/// <reference path="../pb_data/types.d.ts" />

// Per-user storage quota. Uploaded media files count against the limit:
// MAX_USER_DATA_BYTES env (default 20 MB), or MAX_PREMIUM_DATA_BYTES env
// (default 1 GB) for users with the premium flag (set from the PB dashboard).
// The mediaSize field is server-owned and always overwritten here so clients
// cannot fake it.

const GB = 1024 * 1024 * 1024;
const DEFAULT_LIMIT = 20 * 1024 * 1024; // 20 MB
const DEFAULT_PREMIUM_LIMIT = 1 * GB;

function limitBytes(app, userId) {
  let premium = false;
  try {
    premium = app.findRecordById("users", userId).getBool("premium");
  } catch (_) {
    // user record not found — fall back to the free limit
  }
  const env = parseInt(
    $os.getenv(premium ? "MAX_PREMIUM_DATA_BYTES" : "MAX_USER_DATA_BYTES"),
    10,
  );
  if (env > 0) return env;
  return premium ? DEFAULT_PREMIUM_LIMIT : DEFAULT_LIMIT;
}

function limitLabel(limit) {
  return limit >= GB
    ? `${Math.round((limit / GB) * 10) / 10} GB`
    : `${Math.round(limit / 1024 / 1024)} MB`;
}

/** Throws BadRequestError when the request would push the user over the quota. */
function enforceQuota(e) {
  const uploaded = e.record.getUnsavedFiles("media");
  let size;
  if (uploaded.length > 0) {
    size = uploaded[0].size;
  } else if (!e.record.getString("media")) {
    size = 0; // no media, or media removed by this update
  } else {
    // media kept as-is — carry the stored size over
    size = e.record.isNew() ? 0 : e.record.original().getInt("mediaSize");
  }
  e.record.set("mediaSize", size);

  const row = new DynamicModel({ total: 0 });
  e.app
    .db()
    .newQuery(
      "SELECT COALESCE(SUM(mediaSize), 0) AS total FROM tracks WHERE user = {:user} AND id != {:id}",
    )
    .bind({ user: e.record.getString("user"), id: e.record.id })
    .one(row);

  const limit = limitBytes(e.app, e.record.getString("user"));
  if (row.total + size > limit) {
    throw new BadRequestError(
      `Storage limit reached (${limitLabel(limit)} per account). Remove some tracks to free space.`,
    );
  }
}

module.exports = { enforceQuota };
