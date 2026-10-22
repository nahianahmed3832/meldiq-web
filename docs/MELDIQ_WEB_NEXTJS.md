# Meldiq Web on Next.js (Architecture 1.0, ADR 0008)

Meldiq Web moved from a Vite single-page app to Next.js 16 without changing what it does. This page records the
feasibility spike (F0), the decisions it led to, how the app is built and run now, and what to check before a release.
The owner's decision is ADR 0008 in the meldiq_android repository (`docs/architecture/ARCHITECTURE_1_0_PLAN.md`).

## 1. Shape

| Part | Before (Vite 7) | Now (Next.js 16.3.8) |
|---|---|---|
| Entry | `index.html` + `src/main.tsx` | `src/pages/_document.tsx` (page shell, launch screen), `src/pages/_app.tsx` (CSS, viewport), `src/pages/index.tsx` (the app, client-only), `src/client/Root.tsx` (start-up, formerly `main.tsx`) |
| Router | Hash routes (`/#/dms/c/<id>`) | Paths (`/dms/c/<id>`) on the History API (`src/application/router.ts`); old hash links still work |
| Rendering | Client only | Client only. The build renders the empty shell and the launch screen; never a message, key or account data |
| Build | `vite build` → `dist/` | `next build` (static export, Turbopack) → `out/` → `dist/` (`scripts/finish-export.mjs`) |
| Service worker | `vite build --config vite.sw.config.ts` → `dist/sw.js` | Unchanged (Vite library build), after the Next.js build; `npm run dev` builds it into `public/` |
| Colour fallback (Safari < 17.5) | PostCSS plugin in `vite.config.ts` | Same plugin, loaded by `postcss.config.mjs` (`build/postcss-light-dark.cjs`) |
| Browser targets | esbuild `es2022`, `safari16.4` | `browserslist` in package.json: Safari/iOS 16.4+, Chrome/Edge 111+, Firefox 113+ |
| Development | `vite` (proxy `/v1`, `/v2`) | `next dev` (rewrites `/v1`, `/v2` to `ORBIT_API_URL`, WebSocket included, and every app path to the page) |
| Unit tests | Vitest | Vitest (`vite.config.ts` now only configures tests) |
| Hosting | nginx, static files | Unchanged: nginx, static files, same CSP and headers |

`src/app` became `src/application`: Next.js treats a top-level `src/app` folder as its App Router.

## 2. Feasibility spike (2026-10-22)

| Requirement | Result | Evidence |
|---|---|---|
| Static export served by nginx | Works. The app is one static page; nginx already answers every path with `index.html` (`try_files $uri /index.html`) | `scripts/web-server.ts` copies nginx's rules; deep paths load in Chromium, Firefox and WebKit |
| CSP `script-src 'self'` unchanged | **Pages Router: yes.** Its pages load `<script src>` files only, plus a `__NEXT_DATA__` block of `type="application/json"`, which browsers never run, so CSP doesn't apply to it. **App Router: no**: its static export puts two inline scripts in every page (`self.__next_f.push(…)`), which would need `'unsafe-inline'` or per-build hashes | An App Router sample built with the same Next.js version had 2 inline scripts; `dist/index.html` has none (`deploy/scripts/verify.sh` checks it live) |
| No `'unsafe-eval'` | The production build needs none. `next dev` evaluates code for hot reloading, so development runs without the CSP (as with Vite) | Browser tests on the production build run with the production headers |
| Service worker | Registers at `/sw.js` (scope `/`) from the export | Spike in all three engines; `e2e/notifications.spec.ts` |
| IndexedDB, WebCrypto (Ed25519/X25519), the Safari 16 fallback | Unchanged code; works in the export | Spike; `e2e/legacy-safari.spec.ts`, `e2e/accounts.spec.ts` |
| Call media encryption worker | `new Worker(new URL("./e2eeWorker.ts", import.meta.url), { type: "module" })` is compiled by Turbopack into its own worker chunk | `turbopack-worker-*.js` in the build; `e2e/calls.spec.ts` |
| Safari 16.4 syntax | Every built file parses as ES2022 | acorn check over `dist/**/*.js` (35 files) |
| Colour fallback | The `@supports not (color: light-dark(…))` block is in the built CSS with every token. Lightning CSS (Next.js's CSS minifier) only adds unused `--lightningcss-*` variables | `dist/_next/static/chunks/*.css` |

**Decision:** Pages Router, static export, nginx unchanged. No Node.js server, no nonces, no CSP change.

## 3. Decisions

1. **One client-only page, not one Next.js page per screen.** Every screen shows end-to-end-encrypted data that exists
   only in the browser, and conversation ids are unknown at build time, so per-screen pages would all be empty shells
   needing extra nginx rules. The page is a static `index` page rather than a catch-all route: on a deep path, Next.js
   then doesn't re-route on load (which would look the path up among its pages and land on 404). Public pages that
   benefit from server rendering (community previews, marketing) can be added as their own Next.js pages later.
2. **Paths instead of hash routes, on the History API.** The app's router (`src/application/router.ts`) reads
   `location.pathname`, pushes history entries itself, and handles clicks on links to its own paths so they don't reload
   the page. Next.js's router isn't used for moving around: it would treat every move as a page change (data lookups,
   announcements). Its route announcer is therefore hidden (`next-route-announcer { display: none }` in base.css):
   it only speaks on its own page changes, which never happen. In development (where Next.js has rewrites) it may
   rewrite the address once while the page starts; the router listens for that and reads the address again.
3. **Old links keep working.** A hash route (`/#/dms/c/<id>`, from bookmarks, older notifications, links people
   shared) becomes its path at load and when one is opened later. The service worker accepts both forms when a
   notification is clicked (`src/sw/messages.ts › notificationPath`).
4. **The encryption trust boundary doesn't move.** No server rendering of app content, no API calls from a server,
   the same CSP. The engine (`src/sync/engine.ts`), crypto, IndexedDB schemas and key storage are unchanged.
5. **Vite stays for two things:** the service worker (one classic script at `/sw.js`, which Next.js doesn't build)
   and Vitest.
6. **`next dev` writes `AGENTS.md` and `CLAUDE.md`** when it detects an AI coding agent. They aren't part of the
   project and are never committed.

## 4. Commands

```bash
npm run dev
```

`next dev` at http://127.0.0.1:5173, proxying `/v1` and `/v2` to `ORBIT_API_URL` (default `http://127.0.0.1:8080`).
It also builds the service worker into `public/` first.

```bash
npm run build
```

Typecheck, `next build`, `dist/` and `dist/sw.js`. `npm run preview` (`node scripts/web-server.ts dist 4173`) then
serves it like production: the same headers and CSP, `/v1` proxied.

Browser tests run `next dev` behind `scripts/web-server.ts` (per-test client addresses, as before), or with
`ORBIT_E2E_BUILD=1` the production build with the production CSP.

## 5. Release

The release process doesn't change (`docs/ORBIT_WEB_DEPLOYMENT.md`): `deploy/scripts/build-release.sh` builds
`dist/` and the tarball; `install-release.sh` installs it and renders the nginx site; `rollback.sh` returns to the
previous release. Changes for Next.js:
- nginx caches `/_next/static/` for a year, as it does `/assets/` (kept, so a rollback to a Vite release still gets
  its caching; rollback switches the release and keeps the newest nginx site);
- `verify.sh` accepts either page shell, checks that an app path (`/dms`) is served by the app, and that the page has
  no inline script.

**Before the first Next.js release:** check the live release and that the build is from the reviewed commit, run the
full unit, live and browser suites, install on the server, run `verify.sh`, and open the site on a phone.

**Rollback:** `rollback.sh` returns to the last Vite release, which still works. One difference: a Vite release
understands only hash routes, so a path link made while the Next.js release was live (a shared link, or a notification
already on screen) opens Home there instead of its conversation. Nothing is lost; the conversation is one click away.
