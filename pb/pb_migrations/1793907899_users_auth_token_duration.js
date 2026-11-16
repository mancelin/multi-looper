/// <reference path="../pb_data/types.d.ts" />
// Auth token lifetime: 7 days (PB default) -> 90 days. The client also renews
// it on boot and on resume (src/store/sync.ts), so the window slides with usage.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({ "authToken": { "duration": 7776000 } }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({ "authToken": { "duration": 604800 } }, collection)

  return app.save(collection)
})
