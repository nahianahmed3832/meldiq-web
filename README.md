# Meldiq Web

The browser client of **Meldiq** (formerly Orbit; the server and Android code live in
[the Orbit repository](https://github.com/nahianahmed3832/griip-mesage)): another device of your Meldiq account, on the
same server as the Android app. You sign in with your email and password and set the browser up with your recovery key
or your phone's approval; messages are encrypted and decrypted in the browser and the server only relays ciphertext.
One backend, one source of truth.

This repository is **github.com/nahianahmed3832/meldiq-web** (named `orbit-web` until 2026-10-20; the old address
redirects). The app is live at **https://web.meldiq.app**.

- The rebrand from Orbit to Meldiq, what changed and what keeps the old name on purpose, and the plan for
  `web.meldiq.app`: [`docs/MELDIQ_REBRAND.md`](docs/MELDIQ_REBRAND.md)
- Configuration: [`.env.example`](.env.example) and `/config.json` (`src/app/config.ts`)
- Where things stand and what's next: [`docs/MELDIQ_WEB_STATUS.md`](docs/MELDIQ_WEB_STATUS.md); the Android parity
  inventory: [`docs/MELDIQ_WEB_FEATURE_PARITY.md`](docs/MELDIQ_WEB_FEATURE_PARITY.md)
- Design system: the logo and its icons, colour tokens and the Indigo, Plum and Amber plates, scale, messaging:
  [`docs/MELDIQ_DESIGN_SYSTEM.md`](docs/MELDIQ_DESIGN_SYSTEM.md)

- Design and audit: [`docs/ORBIT_WEB_ARCHITECTURE.md`](docs/ORBIT_WEB_ARCHITECTURE.md)
- What works, test evidence, known issues, the phone test: [`docs/ORBIT_WEB_STATUS.md`](docs/ORBIT_WEB_STATUS.md)
- Deployment (not applied yet): [`docs/ORBIT_WEB_DEPLOYMENT.md`](docs/ORBIT_WEB_DEPLOYMENT.md)

In the docs, paths such as `server/…` and `android/…` are in the Orbit repository; everything else is in this one.

## Requirements

- Node 22 or later.
- The Orbit server, for running locally and for the integration and browser tests: the `server/` folder of the Orbit
  repository, **with first-frame WebSocket authentication** (`server/src/ws.ts`; browsers can't send headers on a
  WebSocket). Clone it next to this repository and install it, or point `ORBIT_SERVER_DIR` at its `server/` folder:

```bash
git clone git@github.com:nahianahmed3832/griip-mesage.git ../griip-mesage && (cd ../griip-mesage/server && npm ci)
```

## Run locally

A server with local data in its `data/` folder, open sign-up and no calling:

```bash
bash scripts/local-server.sh
```

The web app on `http://localhost:5173`, proxying `/v1` to `ORBIT_API_URL` (default `http://127.0.0.1:8080`):

```bash
npm install && npm run dev
```

Use `localhost`, not a LAN address: browsers allow WebCrypto only on HTTPS or localhost. Link the browser from a phone
signed in to the same server (Settings › Devices › Approve new device), or with the test tool for a local server:

```bash
npx tsx scripts/demo-phone.ts setup
```

```bash
npx tsx scripts/demo-phone.ts approve ABCDE12345
```

## Calls

Calls need a LiveKit media server. Locally (`brew install livekit` once), start it before the server, and the server
with `--calls`:

```bash
bash scripts/livekit-dev.sh
```

```bash
bash scripts/local-server.sh --calls
```

Design, tests and the phone test: `../docs/ORBIT_WEB_CALLS.md`.

## Checks

```bash
npm run typecheck && npm run lint && npm run format:check
```

Unit tests (no server needed): cryptography against the shared vectors, protocol rules, key storage, routing.

```bash
npm test
```

Integration tests: the web engine against a real server started in-process from the Orbit server folder, with the
server's reference protocol client playing the phone.

```bash
npm run test:integration
```

Browser tests: Chromium, Firefox, WebKit and a phone-sized Chromium, each run with its own throwaway server.

```bash
npx playwright install chromium firefox webkit && npx playwright test
```

The call browser tests (`e2e/calls.spec.ts`) run when `livekit-server` is installed (`brew install livekit`) and the
Orbit repository's `tools/griip-bot` (next to its `server/`) has its dependencies (`npm ci` there); otherwise they're
skipped and say why. Playwright starts its own LiveKit.

## Layout

| Path | What |
|---|---|
| `src/crypto` | griip-envelope-v1, HPKE, Ed25519, attachments, history keys, pairing, key storage (WebCrypto) |
| `src/protocol`, `src/api` | validated payloads, history records and server responses; the API client |
| `src/realtime`, `src/sync`, `src/store` | WebSocket, receive pipeline, outbox, history restore, directory and trust, IndexedDB |
| `src/call` | calls: manager, keys, LiveKit session, encryption worker and frame audit, badge rules |
| `src/state`, `src/app` | app state, React bindings, boot, routes, preferences |
| `src/ui` | the interface |
| `test`, `e2e` | Vitest and Playwright; `test/vectors` holds copies of the shared protocol vectors |
| `scripts` | `local-server.sh` (start the Orbit server for development), `demo-phone.ts` (test participants on a local server) |
