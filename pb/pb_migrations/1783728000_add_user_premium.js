/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    // premium accounts get a bigger media quota (pb_hooks/quota.js); the flag
    // is only settable from the PB dashboard - API rules below reject any
    // request that tries to write it
    users.fields.add(new Field({ name: "premium", type: "bool" }));
    users.createRule = "@request.body.premium:isset = false";
    users.updateRule = "id = @request.auth.id && @request.body.premium:isset = false";
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("premium");
    users.createRule = "";
    users.updateRule = "id = @request.auth.id";
    app.save(users);
  },
);
