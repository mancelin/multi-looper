/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    // set when the duration came from a real decode, so the client's media
    // element must not overwrite it (MediaRecorder webm under-reports itself)
    collection.fields.add(new Field({ name: "durationExact", type: "bool" }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    collection.fields.removeByName("durationExact");
    app.save(collection);
  },
);
