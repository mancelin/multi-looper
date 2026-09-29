/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tracks = app.findCollectionByNameOrId("tracks");
    // the old rule only checked the current owner, so an owner could PATCH
    // `user` to someone else's id and push a track into their library
    tracks.updateRule =
      "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)";
    app.save(tracks);
  },
  (app) => {
    const tracks = app.findCollectionByNameOrId("tracks");
    tracks.updateRule = "user = @request.auth.id";
    app.save(tracks);
  },
);
