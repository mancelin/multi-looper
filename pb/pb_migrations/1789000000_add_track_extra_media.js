/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    // { type: "image", src: <data URL> } | { type: "markdown", text: string }
    // Supersedes the legacy `image` field, which the client clears on its
    // next write once it has folded the value in here.
    collection.fields.add(new Field({ name: "extraMedia", type: "json", maxSize: 2000000 }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("tracks");
    collection.fields.removeByName("extraMedia");
    app.save(collection);
  },
);
