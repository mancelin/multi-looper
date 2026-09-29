/// <reference path="../pb_data/types.d.ts" />

// Cap the number of accounts so a traffic spike can't fill the disk: each
// account may sync up to MAX_USER_DATA_BYTES of media (see quota.js).
// MAX_USERS env, default 6000 (~120 GB at 20 MB each); 0 or negative means
// no cap. Guest mode keeps working once sign-ups close.
//
// onRecordCreate (not onRecordCreateRequest) so it also catches accounts
// created by a first Google sign-in, which never goes through the create
// endpoint. The message prefix is matched by the client (sync.ts).

onRecordCreate((e) => {
  const DEFAULT_MAX_USERS = 6000;
  const env = parseInt($os.getenv("MAX_USERS"), 10);
  const max = isNaN(env) ? DEFAULT_MAX_USERS : env;
  if (max > 0 && e.app.countRecords("users") >= max) {
    throw new BadRequestError("Sign-ups are closed for now.");
  }
  e.next();
}, "users");
