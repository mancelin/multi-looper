/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    const kind = collection.fields.getByName("kind");
    kind.values = ["file", "youtube", "tidal"];
    collection.fields.add(new Field({ name: "tidalId", type: "text", max: 30 }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    const kind = collection.fields.getByName("kind");
    kind.values = ["file", "youtube"];
    collection.fields.removeByName("tidalId");
    app.save(collection);
  },
);
