/// <reference path="../pb_data/types.d.ts" />

// Cap the media storage each user may sync (logic in quota.js).

onRecordCreateRequest((e) => {
  require(`${__hooks}/quota.js`).enforceQuota(e);
  e.next();
}, "tracks");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/quota.js`).enforceQuota(e);
  e.next();
}, "tracks");
