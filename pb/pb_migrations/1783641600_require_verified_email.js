/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    // password sign-in only works after the verification email was clicked
    users.authRule = "verified = true";
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authRule = "";
    app.save(users);
  },
);
