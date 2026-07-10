/// <reference path="../pb_data/types.d.ts" />

// Per-user storage quota. Uploaded media files count against the limit
// (MAX_USER_DATA_BYTES env, default 20 MB). The mediaSize field is
// server-owned and always overwritten here so clients cannot fake it.

const DEFAULT_LIMIT = 20 * 1024 * 1024; // 20 MB

function limitBytes() {
  const env = parseInt($os.getenv("MAX_USER_DATA_BYTES"), 10);
  return env > 0 ? env : DEFAULT_LIMIT;
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

  const limit = limitBytes();
  if (row.total + size > limit) {
    throw new BadRequestError(
      `Storage limit reached (${Math.round(limit / 1024 / 1024)} MB per account). Remove some tracks to free space.`,
    );
  }
}

module.exports = { enforceQuota };
