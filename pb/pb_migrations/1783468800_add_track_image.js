/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    // cover image stored as a downscaled data URL
    collection.fields.add(new Field({ name: "image", type: "text", max: 2000000 }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    collection.fields.removeByName("image");
    app.save(collection);
  },
);
