/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    // library position for drag-and-drop reordering (ascending; may be negative)
    collection.fields.add(new Field({ name: "sortOrder", type: "number" }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    collection.fields.removeByName("sortOrder");
    app.save(collection);
  },
);
