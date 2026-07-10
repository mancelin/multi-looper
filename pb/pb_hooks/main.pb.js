/// <reference path="../pb_data/types.d.ts" />

// Sync Google OAuth2 on the users collection from env vars on every boot,
// so credentials stay out of the repo and can be rotated without a migration.
// Both vars set -> provider enabled; otherwise OAuth2 is switched off.
onBootstrap((e) => {
  e.next();

  const clientId = $os.getenv("GOOGLE_CLIENT_ID");
  const clientSecret = $os.getenv("GOOGLE_CLIENT_SECRET");
  const enabled = !!clientId && !!clientSecret;

  const users = e.app.findCollectionByNameOrId("users");
  unmarshal(
    {
      oauth2: {
        enabled: enabled,
        providers: enabled
          ? [{ name: "google", clientId: clientId, clientSecret: clientSecret }]
          : [],
      },
    },
    users,
  );
  e.app.save(users);
});
