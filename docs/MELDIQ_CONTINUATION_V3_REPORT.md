# Meldiq Web continuation v3: report (2026-10-27)

Brief: `Meldiq_Web_Continuation_Prompt_v3.md` (web first; native apps untouched). API **0.45.0** (meldiq
`meldling-api`) and Meldiq Web (meldiq-web `meldling`).

## 1. What changed

| Area | Result | Main files |
|---|---|---|
| File transfers | Sending is a transfer owned by the app, not the message box: it keeps going and stays visible when you change conversations, the same send joins the running one (no duplicates), and after a reload it comes back as interrupted with Resume. One encryption pass instead of two, in a Web Worker. Multipart uploads go 3 parts at a time with retries, and continue with only the parts the server lacks. Large downloads resume with Range requests; their verified ciphertext is kept, so reopening after a reload doesn't download again | `crypto/cipherJobs.ts`, `cipher.worker.ts`, `cipherClient.ts`, `sync/transfers.ts`, `sync/largeUpload.ts`, `sync/attachments.ts`, `ui/chat/TransferList.tsx` |
| Invitation links | Made on the web app's own address (`https://web.meldiq.app/invite/CODE`); old `meldiq.app` links still recognised; a message link (`/m/…`) opens in a fresh tab too | `sync/inviteCodes.ts`, `sync/messageLinks.ts`, `sync/webOrigin.ts`, `application/pendingInvite.ts` |
| Invite entry points | "Invite friends" card on Home and messages (names the community, picks among several, or says to start one); "Invite people" under the community banner; the community icon's menu; all open the one Invite dialog | `ui/shell/SidebarSections.tsx`, `Sidebar.tsx` |
| Notification sound | Meldiq's chime plays with system notifications too (they're then silent: one sound); a suspended audio context is resumed; when sound is still blocked, one notice; Test sound says whether it played or the browser blocked it | `application/messageChime.ts`, `boot.ts`, `ui/settings/PreferencePages.tsx` |
| Registration | Desktop: a community-first hero (Meldling, headline, four real capabilities, an illustration of a community, no invented numbers) beside a comfortable form; the intro is a split screen; phones: a compact branded header | `ui/auth/AuthFrame.tsx`, `IntroPages.tsx`, `styles/views.css`, `responsive.css` |
| Favicon | Meldling's silhouette only on a transparent ground: teal for light browser chrome, white for dark, 16/32/48/192 px, made from the approved asset (no redrawing); the unread badge paints on them | `scripts/render-brand-assets.mjs`, `public/favicon-{light,dark}-*.png`, `pages/_document.tsx`, `application/tabBadge.ts` |
| Context menus | Right-click or two-finger click opens Meldiq's menu at the pointer on messages, channels, categories, conversations, members and community icons; the Menu key and Shift+F10 open it from the keyboard; text fields, links, media and selected text keep the browser's menu; nothing blocks developer tools | `ui/components/Overlay.tsx` (`contextMenuProps`, `keepsNativeMenu`), `MessageItem.tsx`, `Rail.tsx`, `PeoplePanels.tsx`, `ConversationRow.tsx`, `CommunityPanel.tsx` |
| Duplicates removed | Community menu: no community switcher, Create or Discover (the rail has them); Invite first, Leave and Copy ID last; Activity out of the profile menu (it has its own button) | `CommunityHeader.tsx`, `ProfileMenu.tsx` |
| Navigation | The rail and the phone strip: edge fades while there's more, the selected community kept in view, arrow keys/Home/End between items, mouse drag and wheel on the horizontal strip (a drag never opens what it started on); channel lists keep their scroll position per community | `ui/components/scrollStrip.ts` |
| Profile customisation | Animated avatar (GIF, WebP, or a short clip the server turns into a 3 s silent loop), banner (still or animated), six original avatar frames, four banner effects, a banner colour; preview in Settings › Profile; the profile card plays it; reduced motion keeps everything still | API `profileMediaRoutes.ts`, `mediaFormats.ts`; web `ui/people/ProfileStyle.tsx`, `ui/settings/ProfileStyleCard.tsx`, `styles/profile.css` |
| Emoji, GIFs, Stickers | One picker with tabs in that order, opened by three toolbar buttons in that order; emoji go in at the caret; GIF search through the server (Tenor or GIPHY); stickers (Meldiq's packs, the community's, animated emoji) | `ui/chat/ExpressionPicker.tsx`, `GifView.tsx`, `sync/gifs.ts`; API `gifsRoutes.ts` |

## 2. Encryption and transfers: causes, changes, measurements

**Causes found.** The upload lived inside the message box component: switching conversation unmounted it, so the
progress disappeared and choosing the file again started a second, duplicate upload. A large upload encrypted the
whole file twice (once to hash the ciphertext, once to send it), on the page's thread. An interrupted multipart upload
was deleted and started from zero. Files over 25 MB were never kept, so every reopen after a reload downloaded and
decrypted them again (over 64 MB, every reopen). The ciphertext's SHA-256 is computed in JavaScript (@noble/hashes) and
is by far the slowest step: 165 MB/s against 3,300 MB/s for AES-GCM (Node 25, this Mac).

**What was measured.**

| Measurement | Before | After |
|---|---|---|
| Upload crypto, Node (`npx tsx scripts/bench-transfer.ts`, warm): 32 / 128 / 256 MB | 233 / 873 / 1760 ms (two passes) | 217 / 830 / 1657 ms (one pass) |
| A 60 MB file sent in Chromium, local API, three runs each (`continuation-v3.spec.ts` "60 MB" and the same test on the previous commit) | 2.5 to 2.7 s; one long task of 238 to 494 ms | 2.5 to 2.6 s; one long task of 278 to 354 ms |

So the honest result is: **no measurable speed change** for a 60 MB file on this machine (the API path, which this
local server uses, sends one body; the 3-at-a-time parts apply only on servers that use S3, and production does). What
changed is that transfers no longer restart or duplicate, resume after interruptions, and don't download a large file
again when it's reopened. Faster hashing would need WebAssembly (`'wasm-unsafe-eval'` in the page's CSP), which wasn't
added without the owner deciding on that trade-off.

## 3. Resume, reuse and keys

- Kept in this browser's database (erased with everything else on sign-out, so never visible to another account):
  each large file's **ciphertext** and where its upload got to. The file key is kept only **sealed** with a
  non-extractable AES-GCM key that never leaves the browser; no raw key and no plaintext is stored. A test checks it.
- A completed upload isn't repeated: its attachment id is kept, and the message is sent through the outbox.
- Reused ciphertext is always verified again when opened: every chunk's tag, index and final flag, the chunk count
  and the whole hash; a kept copy that fails is dropped and downloaded once more.
- After a full browser restart, a file whose encryption hadn't finished needs to be chosen again (a page can't reopen a
  file by itself); the transfer says so ("Choose file…").
- Same format as before (Android-compatible): no protocol change.

## 4. Invitation links

**Cause:** links were made as `https://meldiq.app/invite/CODE`, but `meldiq.app` (the apex A record, 2.57.91.91)
has no web server at all: it doesn't answer on HTTP or HTTPS. Only `web.meldiq.app` serves the invitation page.

**Fixed:** links are now made on the address the app is served from (`https://web.meldiq.app/invite/CODE`); a fresh
browser loads the page, signing in or up keeps the code and opens Join, members see "You're already in. Open it".
Old `meldiq.app` links are still recognised when pasted or clicked inside Meldiq.

**Still needs the owner:** links already shared with `meldiq.app`, and the Android app's links (which also use
`meldiq.app`), only work once `meldiq.app` points at the VPS. The nginx site is ready on the VPS
(`/etc/nginx/sites-available/meldiq-apex.conf`: redirects `/invite/…`, `/m/…` and everything else to web.meldiq.app,
and serves `/.well-known/assetlinks.json` for Android App Links); changing the DNS record was refused without the
owner's explicit approval. After DNS: `certbot certonly --webroot -w /var/www/griip-message-acme -d meldiq.app -d
www.meldiq.app` and a 443 block.

## 5. Notification sound

**Cause:** when Meldiq wasn't the focused tab it showed a system notification and skipped its own chime, relying on
the system's notification sound, which Chrome on macOS (and often Windows) doesn't play. **Fixed** as in §1. Browser
limits that remain: sound can start only after one click in the tab (browser rule; Meldiq says so once), and the
operating system's own notification settings can still mute or hide notifications.

## 6. Other results

- Registration: checked at 1440 × 900 and 375 × 812 (screenshots), light and dark.
- Favicon: silhouettes checked on light and dark tab colours at 16, 32 and 192 px.
- Context menus: browser test (pointer position, Escape, the message box keeps the browser's menu, Shift+F10).
- Profile media: GIF/WebP checked by structure, sizes and frames; clips re-encoded by ffmpeg (tested with a real 4 s
  clip with sound: out came 3 s, 320 × 320, video only); video banners aren't offered.
- GIFs: off in production until a provider key is added (`GIF_PROVIDER`, `GIF_API_KEY`; docs/GIFS.md); the GIF tab
  says so.

## 7. Checks

| Check | Result |
|---|---|
| API `tsc --noEmit` | clean |
| API full suite | 1,116 passed, 11 skipped (the docs check passes after `npm run contracts`); new `profile_media` (7), `gifs` (3) |
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests | 529 passed, 1 skipped; new `transfers` (6), `message-chime` (3), link tests |
| Browser suite, Chromium + phone width, against API 0.45.0 | see Production below |

## 8. Native apps

No file under `android/` changed in this round (`git diff --name-only 3b9d97d..HEAD -- android`: none); no app id,
signing, version or Play Store change. API changes are additive (new fields and routes).
