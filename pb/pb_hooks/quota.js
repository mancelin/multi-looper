/// <reference path="../pb_data/types.d.ts" />

// Per-user storage quota. Everything a track stores counts against the limit:
// the uploaded media file plus its text/JSON fields (peaks, loops, notes,
// images as data URLs), otherwise an account could fill the disk with many
// file-less records. MAX_USER_DATA_BYTES env (default 20 MB), or
// MAX_PREMIUM_DATA_BYTES env (default 1 GB) for users with the premium flag
// (set from the PB dashboard). The mediaSize field holds that per-track total;
// it is server-owned and always overwritten here so clients cannot fake it.

const GB = 1024 * 1024 * 1024;
const DEFAULT_LIMIT = 20 * 1024 * 1024; // 20 MB
const DEFAULT_PREMIUM_LIMIT = 1 * GB;

function limitBytes(app, userId) {
  let premium = false;
  try {
    premium = app.findRecordById("users", userId).getBool("premium");
  } catch (_) {
    // user record not found - fall back to the free limit
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

// Fields that don't hold user data (or, for the file, are measured apart).
const UNCOUNTED_TYPES = ["file", "relation", "autodate"];
const UNCOUNTED_NAMES = ["mediaSize"];

/** UTF-8 byte length of a string. */
function utf8Bytes(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4; // surrogate pair: one 4-byte code point
      i++;
    } else n += 3;
  }
  return n;
}

/** Bytes a record's text/JSON fields take, as stored. */
function dataBytes(record) {
  let n = 0;
  for (const field of record.collection().fields) {
    const name = field.getName();
    if (UNCOUNTED_TYPES.indexOf(field.type()) !== -1) continue;
    if (UNCOUNTED_NAMES.indexOf(name) !== -1) continue;
    n += utf8Bytes(record.getString(name));
  }
  return n;
}

/** Size of the media file after this request, in bytes. */
function fileBytes(app, record) {
  const uploaded = record.getUnsavedFiles("media");
  if (uploaded.length > 0) return uploaded[0].size;
  const name = record.getString("media");
  if (!name || record.isNew()) return 0; // no media, or removed by this update
  // media kept as-is: read the stored file's real size
  const fsys = app.newFilesystem();
  try {
    return fsys.attributes(record.baseFilesPath() + "/" + name).size;
  } catch (_) {
    return 0; // file missing from storage - nothing to count
  } finally {
    fsys.close();
  }
}

/** Throws BadRequestError when the request would push the user over the quota. */
function enforceQuota(e) {
  const size = fileBytes(e.app, e.record) + dataBytes(e.record);
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
