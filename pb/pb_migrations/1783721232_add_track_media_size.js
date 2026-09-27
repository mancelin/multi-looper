/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    // media file size in bytes - server-owned, set by pb_hooks/quota.pb.js
    collection.fields.add(
      new Field({ name: "mediaSize", type: "number", min: 0, onlyInt: true }),
    );
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    collection.fields.removeByName("mediaSize");
    app.save(collection);
  },
);
