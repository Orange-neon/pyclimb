# Collaboration relay

This Worker is the ephemeral Yjs and execution-control relay for collaborative
notebooks. Firebase remains the authority for room membership; notebook source
is held only in browsers and the hibernating Durable Object.

## Local checks

Run the worker independently of the Vite application:

```sh
npx tsc -p workers/collaboration/tsconfig.json
npx vitest run --config workers/collaboration/vitest.config.ts
npx wrangler deploy --dry-run --config workers/collaboration/wrangler.jsonc
```

These commands are suitable for `relay:typecheck`, `relay:test`, and
`relay:build` package scripts.

Copy `.dev.vars.example` to `.dev.vars` inside this directory and replace its
values. `RELAY_TICKET_SECRET` must contain at least 32 random UTF-8 bytes. Never
commit `.dev.vars`.

```sh
npx wrangler dev --config workers/collaboration/wrangler.jsonc
```

## Production setup

Create the signing secret once in Cloudflare:

```sh
npx wrangler secret put RELAY_TICKET_SECRET --config workers/collaboration/wrangler.jsonc
```

Deploy with the non-secret bindings supplied by CI:

```sh
npx wrangler deploy --config workers/collaboration/wrangler.jsonc \
  --keep-vars \
  --var "FIREBASE_DATABASE_URL:https://PROJECT-default-rtdb.firebaseio.com" \
  --var "ALLOWED_ORIGINS:https://USER.github.io"
```

Set the frontend's `VITE_COLLAB_RELAY_HOST` to the deployed Worker origin.
Cloudflare observability is deliberately disabled because WebSocket ticket
values appear in connection query strings.

## Client protocol

Request tickets with `POST /relay-ticket`, a Firebase ID token in the Bearer
header, and `{ "code", "roomInstanceId" }`. The response contains 60-second
`syncTicket` and `controlTicket` capabilities, an epoch-millisecond `expiresAt`,
and the exact `websocketUrl`.

The normal client needs only one socket:

```ts
import YProvider from "y-partyserver/provider";

const provider = new YProvider(relayHost, roomInstanceId, ydoc, {
  party: "collaboration-room",
  disableBc: true,
  params: async () => ({ ticket: (await refreshTickets()).syncTicket }),
});

provider.sendMessage(JSON.stringify(runRequest));
provider.on("custom-message", (json: string) => handleRelayMessage(JSON.parse(json)));
```

`controlTicket` supports an optional control-only WebSocket at
`websocketUrl?ticket=...`. Its messages use the Y-PartyServer
`__YPS:<json>` envelope. The shared message types are exported from
`src/protocol.ts`.

The `syncTicket` is intentionally the full-capability ticket in v1: the
single-socket provider shown above carries both Yjs and custom run messages.
The `controlTicket` is a strict control-only subset for clients that want a
second socket. Because both tickets are issued together to the same verified
member, accepting control messages on the sync channel does not grant an
additional room capability; strict channel separation would require a
two-socket client protocol change.

Yjs sync frames allow a 4 MiB document plus 64 KiB of protocol headroom so a
late joiner or hibernation wake can transfer the full capped document.
Awareness frames are capped at 64 KiB and control frames at 256 KiB; normal
incremental Yjs updates remain beneath the 4 MiB merged-document cap.

When the final authenticated sync WebSocket closes, the Worker calls
`DurableObjectState.abort()` to discard the entire in-memory Y.Doc generation.
It intentionally does not apply an empty Yjs update, because that would create
deletion tombstones capable of wiping a reconnecting browser's offline copy.
Cloudflare does not implement `abort()` in `wrangler dev`; final-disconnect
disposal therefore requires the deployed runtime (or a local dev-server
restart), while the production Worker enforces it immediately.
