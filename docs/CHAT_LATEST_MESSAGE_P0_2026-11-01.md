# P0 fix: conversations open at their latest messages

Released on 2026-11-01 at https://web.meldiq.app as **0.5.0-beta-dfd65d0**, from branch `codex/chat-open-latest`. The running API remains **0.68.0**.

## Root cause and investigation

The problem was in frontend navigation and request ownership:

- `useReadingPosition` restored a historical session anchor or scrolled to the first unread message instead of opening at latest. A later unread update could also move an already initialized viewport upward.
- `Engine.openConversation` skipped fetching when a conversation already had server-page metadata. This reused a paginated or detached search window when returning to a conversation.
- First-page requests were coalesced only by conversation ID. Reopening the same conversation while a previous request was pending could reuse that earlier opening's request.
- Cached/snapshot messages could reach a reused component before the fresh opening request completed. The viewport needed an explicit opening generation and readiness boundary.

The backend was already correct. SQLite and MongoDB fetch newest-first using timestamp and message ID, with exclusive composite cursors for older pages. The API returns descending pages; the client ingests history and renders canonical ascending timestamp/ID order. Backend cursor tests verified both stores, including equal timestamps. No query reversal or protocol change was needed.

The list uses ordinary DOM elements, not virtualization. Its real scroll container is `.messages.scroll`; existing `overflow-anchor: none` is retained. No CSS reversal or timeout-based initialization was added.

## Frontend behavior and initialization

Every ordinary DM, group, or community-channel entry requests the newest 60-message page, including reopening, switching, refresh, signing in again, and restoration from the browser's Back/Forward cache. Cached historical windows cannot choose the opening position.

Each entry invalidates the earlier window generation. Requests coalesce within that generation; stale completions cannot replace the newer window or advance its pagination metadata. The published window contains the fetched message IDs plus newer concurrent arrivals, deduplicated and ordered by timestamp/ID. Timestamp ties do not pull older cached messages back into the opening window.

The shell invalidates the old view in a layout effect. The conversation shows its loading state until history is ready. After the fresh batch renders, the message-list layout effect sets the actual container's `scrollTop` to `scrollHeight`, before paint. An opening revision resets the viewport even when the conversation component otherwise stays mounted. Browser automatic scroll restoration is disabled while application routing owns the viewport.

Unread dividers remain available, but no longer override latest-first entry. Read acknowledgments still require a ready, focused latest view.

## Pagination, incoming messages, and attachments

Older pages continue using the server's existing composite cursor. Prepends preserve the first visible message and its pixel offset, including when a real-time message arrives during the fetch. Duplicate IDs are removed without gaps between history windows.

At latest, incoming messages and media/layout expansion keep the viewport at the bottom. While reading history, arrivals from other people or another device of the same account preserve the reading anchor and leave Jump to latest available. Explicit search-result navigation keeps its separate contiguous window.

Jump to latest scrolls smoothly, respects reduced-motion preferences, and retargets when content grows during the animation. ResizeObserver and container-size tracking preserve anchors through photo decoding and viewport changes. Routine scroll-completion events cannot overwrite an anchor after image growth; completion also works without a `scrollend` event, as on older Safari versions.

## Modified implementation and regression files

| File | Change |
|---|---|
| `src/sync/engine.ts` | Fresh newest-page openings, request generations, bounded server windows, concurrent arrivals and stable timestamp ties. |
| `src/state/store.ts` | Opening revision on conversation message state. |
| `src/ui/shell/Shell.tsx` | Invalidate old windows before paint; reopen on persisted `pageshow`. |
| `src/ui/chat/ConversationView.tsx` | Readiness-gated list and opening key; remove ordinary saved-anchor restoration. |
| `src/ui/chat/MessageList.tsx` | Use latest-first positioning; prevent pagination before initialization. |
| `src/ui/chat/useReadingPosition.ts` | Initialize at bottom; retain active reading anchors; handle smooth jumps and media resizing. |
| `src/application/router.ts` | Application-owned scroll restoration, restored on cleanup. |
| `test/history-navigation.test.ts` | Reopening detached windows, overlapping openings, timestamp ties/edits and arrivals during cache reads. |
| `test/snapshot-actions.test.ts` | Typed history-page fixture and isolated summary/call dependencies. |
| `e2e/chat-open-latest.spec.ts` | DM/group/channel opening matrix, switching, Back, settings, refresh, restored pages, delayed requests, sign-in again and real photo attachments. |
| `e2e/research-improvements.spec.ts` | Replace old persistent-anchor/unread-entry expectations; preserve pagination, active reading, image growth and smooth-jump regressions. |

This report is the additional documentation file. The verified source patch was also applied to the original workspace, preserving its existing checkout/billing edits. Existing generated output in that workspace was preserved; the deployment artifact is in the isolated release checkout.

## Validation and results

| Check | Result |
|---|---|
| Release TypeScript and ESLint checks | Passed. |
| Full web unit suite | 108 files passed; 808 tests passed, 1 existing skip. |
| Original workspace TypeScript after applying the patch | Passed. |
| Backend `message_history_cursor.test.ts` and `server_messages.test.ts` | 16 passed, including SQLite and MongoDB cursor ordering. |
| Production-mode browser scenarios | 34 unique scenarios passed across desktop Chromium, WebKit and Pixel 7 Chromium emulation; 5 existing project-specific skips. |
| Final corrected large-history ordering matrix | 9/9 passed: DM, group and channel on all three browser projects. |
| Release build | Passed; built without test device-linking enabled. |
| Live deployment verification | Passed: artifact/origin HTML equality, TLS, security headers, app routes, uncached runtime configuration, API health and WebSocket upgrade 101. |
| Public mobile-width browser smoke | Passed in Chromium and WebKit at 390 × 844: HTTP 200, API 0.68.0, zero page errors, retired test-pairing option absent. |

The browser matrix originally had two assertions that assumed loop/send ordinal order within a millisecond. Those assertions were corrected to compare DOM message IDs with the server's chronological page order. The final nine-case rerun passed; the other 25 executed scenarios had already passed against the same product code. Five existing skips cover desktop-only legacy cases and the hidden phone search panel. Authenticated browser tests use a throwaway API and the production-mode app with test pairing enabled; the shipped release omits that pairing path.

## Backend compatibility and deployment

No backend source, API shape, database schema, migration, or Android client was changed. Backend ordering tests passed against the existing API. Only the web release was switched and Nginx reloaded; the API, MongoDB and LiveKit remain on their existing deployment.

- Current web directory: `/opt/meldiq-web/releases/0.5.0-beta-dfd65d0`.
- Previous web directory retained: `/opt/meldiq-web/releases/0.5.0-beta-0193e7c`.
- Backup and deployment verification metadata: `/opt/meldiq-web/backups/pre-chat-open-latest-dfd65d0`.
- Artifact: `release/meldiq-web-0.5.0-beta-dfd65d0.tar.gz`.
- Artifact SHA-256: `11e3e81fcdeb9e819697c01e015d2d0928d21b91090b7508015f827e9b4d6fa1`.

The runtime configuration was copied unchanged. The switch was atomic, with rollback on failed verification.

## Remaining limitations

Physical iPhone and Android devices were not available. Coverage uses WebKit, Chromium and Pixel 7 emulation, plus a public mobile-width smoke test. Back/Forward-cache restoration is exercised through its persisted page event; actual OS app termination/resumption was not physically tested. Firefox was not included in this targeted browser matrix.

A fresh newest page requires a reachable API. The existing cached-history fallback remains available when it cannot be reached; it cannot guarantee messages that the server has not delivered.
