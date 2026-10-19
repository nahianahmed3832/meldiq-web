# Orbit Web: architecture assessment and plan (2026-10-18)

Orbit Web is the desktop-first browser client of Orbit. It is **another device of the same account** on the same server:
one backend, one source of truth, several clients. This page records what the repository actually contains, what a browser
client needs that the backend lacked, and how the web client is built. Status of each item is in `ORBIT_WEB_STATUS.md`.

## 1. What exists (audit of `internal-beta` at 6f355a1)

| Area | Finding (with source) |
|---|---|
| Repository | Monorepo: `android/` (Kotlin, Compose, Room + SQLCipher, LiveKit Android), `server/` (Node 22, TypeScript, Fastify 5, better-sqlite3, zod, vitest), `tools/griip-bot`, `deploy/` (Compose, nginx, LiveKit, ntfy, AWS S3 stack). No web client existed. |
| Server | One process, SQLite in WAL mode, migrations in `server/migrations/`. Files on local disk or S3 (`src/storage`). Production `msg.griipbuddy.cloud` reports **0.2.0**; this branch is 0.3.0. |
| Accounts | No passwords. An account is an Ed25519 **identity key** made on the phone; each device has its own Ed25519 signing key and X25519 encryption key, bound by a **device certificate** signed by the identity key (`routes/auth.ts`, `docs/SECURITY.md` §2). |
| Sessions | Challenge-response login signed by the device key; 256-bit bearer token, stored hashed, 7 days. Clients re-authenticate by signing a fresh challenge. |
| Multi-device | Built in. A new device starts `POST /v1/pairing`, shows a 10-character code; the phone approves it in **Settings → Devices → Approve new device**, signs the certificate and seals the identity seed to the new device's transfer key (HPKE, info `griip-pairing-v1`). The new device then calls `/v1/auth/add-device`. |
| Messages | End-to-end encrypted `griip-envelope-v1` (AES-256-GCM content, HPKE key wrap per recipient device, Ed25519 signature). The server checks the signature and that recipients equal the members' active devices (`409 device_mismatch` otherwise), fans out one queue row per device, and **never sees content**. The sender's own other devices are recipients, so every device of an account gets every message. |
| Payloads | JSON inside the envelope (`android/.../data/model/Models.kt`): `text`, `edit`, `delete`, `reaction`, `pin`, `read`, `call_invite`, `call_key_request`. Controls target a message id in the same conversation. |
| Realtime | `GET /v1/ws`. Server → client `hello`, `queue` (+`backlog`), `queue.drained`, `typing`, `presence`, `call`, `conv.updated`, `org.updated`, `org.deleted`, `devices.changed`; client → server `ack`, `typing`, `ping`. Items stay queued until acknowledged (max 7 days); REST fallback `GET /v1/queue` + `POST /v1/queue/ack`. |
| History | Lives on devices. Since 2026-10-17 each account's devices also upload **encrypted** history items (`/v1/history/items`), keyed by HKDF of the identity seed; the server sees counts, sizes and times only (`docs/MESSAGE_HISTORY.md`). Production lists the `history` feature. |
| Workspaces | Orgs → branches → departments → teams, channels scoped to org/branch/team, roles Owner…Guest, all enforced in `server/src/authz.ts`; non-members get 404 (`test/orgs.test.ts`). |
| Attachments | Encrypted on the device (AES-256-GCM, key inside the message), uploaded as ciphertext (`POST /v1/attachments`, or direct-to-S3), downloaded only by conversation members; 7-day TTL, 365 days when kept for history. |
| Calls | Self-hosted LiveKit SFU. `POST /v1/calls` issues a room-scoped 10-minute token; media E2EE uses a per-call key sent inside an envelope (`call_invite`), only accepted from the call's creator (`docs/CALLING_AND_E2EE.md`). |
| Retention | Queue ≤ 7 days (hard cap), attachments 7 days (kept: 365), sessions 7 days, history until the person deletes it, call records 90 days (`docs/RETENTION.md`). |

## 2. What blocked a browser client

| # | Gap | Resolution |
|---|---|---|
| G1 | The WebSocket reads the session token from the `Authorization` header of the upgrade request. Browsers can't set headers on a WebSocket. | **Server extension (backward compatible):** a socket without the header may authenticate with its first frame, `{"t":"auth","token":"…"}`, within 10 s. The token never goes in a URL. Android is unchanged. |
| G2 | The API sends no CORS headers. | **No server change.** The web app is served from the same origin as the API: the Vite dev server proxies `/v1` in development; in production nginx serves this repository's `dist/` build and proxies `/v1` (`ORBIT_WEB_DEPLOYMENT.md`). |
| G3 | With S3 storage, attachment downloads redirect to a presigned S3 URL. A browser follows it only if the bucket allows the web origin (CORS). | Deployment setting on the bucket, documented; not applied (production change needs approval). Local-disk storage needs nothing. |
| G4 | Production runs 0.2.0 without G1. | Deploying is a production change: not done without approval. Development and the phone test use a server started from this branch on the developer's Mac. |

Nothing else was missing: accounts, linking, keys, messages, receipts, history, attachments and authorisation already work for
any client that speaks the protocol. No second database, message store or parallel backend is introduced.

## 3. Design of the web client (this repository)

- **A browser is an Orbit device.** It generates its own Ed25519 signing key and X25519 encryption key as **non-extractable
  WebCrypto keys** kept in IndexedDB, and is linked to the account by the phone through the existing pairing flow. Page script
  can use the keys but can't read their bytes.
- **The identity seed** arrives once, sealed, during linking. The browser checks it matches the account's identity key, derives
  the history keys from it (non-extractable AES-GCM and HMAC keys), and then drops it. A browser therefore can't approve other
  devices or reveal the recovery key: those stay on the phone.
- **Same cryptography as the phone.** `griip-envelope-v1`, attachments and history items are implemented with WebCrypto and
  `@hpke/core` (the library the reference client uses), and checked against the shared vectors file that the Android and server
  tests already verify (`android/app/src/test/resources/griip-envelope-v1-vectors.json`).
- **Same rules as the phone.** Trust on first use with pinned identity keys (a changed key pauses sending and holds incoming
  messages), certificate checks on every device, controls applied only to messages in their own conversation, read receipts
  only in DMs and groups of up to 20, server timestamps for ordering, idempotent message ids for retries.
- **Local data.** Decrypted messages this browser received or restored live in IndexedDB on this computer, as the phone keeps
  them in its database. **Sign out** revokes this browser on the server (contacts stop encrypting to it) and erases its keys and
  data. Browser storage is not as strong as SQLCipher behind Android Keystore; the settings page says so.
- **History.** On linking, the browser downloads and decrypts the account's server history, so existing chats appear.
  It does not upload history in this version: the phone receives a copy of everything the browser sends or receives and
  uploads it.
- **Layout.** Workspace rail, sidebar (Home, DMs, Activity, channels, direct messages), conversation with composer, details
  panel, top bar with search, notifications and profile menu; settings pages for what the backend supports. Orbit's Ivory and
  Cocoa palettes and the glossy Orbit mark, from `android/.../ui/theme/OrbitPalettes.kt`.

## 4. Stages

1. Backend extension G1 with tests. *(server)*
2. Web crypto and protocol layer, verified against the shared vectors and the Node reference client. *(web)*
3. Typed API client, realtime client (reconnect, backlog, acks), sync engine and IndexedDB store, tested against an in-process
   server with the reference client playing the phone. *(web)*
4. Interface: linking, shell, conversations, composer, attachments, settings, states. *(web)*
5. Browser tests (Chromium, Firefox, WebKit, desktop and phone widths) against a local server. *(web)*
6. Physical-device test with the Android app on a phone, on the developer's network (`ORBIT_WEB_STATUS.md` › Phone test).
7. Calls in the browser (2026-10-18): LiveKit JS with the same media E2EE as the phone, no server change
   (`ORBIT_WEB_CALLS.md`). Built and tested in browsers; they need interop verified between a browser and a physical
   phone before they can be called supported.
