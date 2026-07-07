/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const collection = new Collection({
      type: "base",
      name: "tracks",
      listRule: "user = @request.auth.id",
      viewRule: "user = @request.auth.id",
      createRule: "user = @request.auth.id && @request.body.user = @request.auth.id",
      updateRule: "user = @request.auth.id",
      deleteRule: "user = @request.auth.id",
      fields: [
        {
          name: "user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "kind", type: "select", required: true, values: ["file", "youtube"], maxSelect: 1 },
        { name: "hasVideo", type: "bool" },
        { name: "title", type: "text", max: 500 },
        { name: "artist", type: "text", max: 500 },
        { name: "tags", type: "json", maxSize: 100000 },
        { name: "duration", type: "number", min: 0 },
        { name: "loops", type: "json", required: true, maxSize: 500000 },
        { name: "activeLoopId", type: "text", max: 100 },
        { name: "accent", type: "text", max: 30 },
        { name: "peaks", type: "json", maxSize: 2000000 },
        { name: "thumb", type: "url" },
        { name: "videoId", type: "text", max: 20 },
        { name: "media", type: "file", maxSelect: 1, maxSize: 209715200 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_tracks_user ON tracks (user)"],
    });

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    app.delete(collection);
  },
);
