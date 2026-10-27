# Meldiq Web: the owner's 2026-10-28 round

The owner's screenshots and notes after v4 went live (sounds, menus, the viewer, folders, Friends, calls, themes,
wording). Branches: meldiq-web `continuation-v4` (after fbe8ba3), meldiq `v5-api` (API **0.50.0**, on
`internal-beta` 4e81b3d, which has the billing session's 0.49.0).

| Asked | Done | Main files |
|---|---|---|
| Ringtone and notification sound (the two files sent) | The bell plays for new messages, the classic ring loops for incoming calls; converted to small MP3s (31 KB, 128 KB) served from `/sounds`; the old synthesized tones stay as the fallback while a file loads or if it can't | `public/sounds/`, `application/soundFiles.ts`, `messageChime.ts`, `call/ringtone.ts` |
| Outline bugs (photos 1–2) | The New message, New group, Forward and People search boxes drew the bare input's own focus ring at the wrong size; the box now shows the focus | `styles/base.css` |
| No browser menu on right-click (photo 3) | Only text fields keep the browser's menu (paste, spelling). On a message: a photo gets Open photo, Download photo, Copy image; a video or sound, Download; a link, Open link, Copy link; selected text, Copy; then the message's own items. Nothing blocks developer tools | `components/Overlay.tsx` (`keepsNativeMenu`), `chat/contextTarget.tsx`, `MessageItem.tsx` |
| Viewer: no download, options behind the photo (photo 4) | Cause: the viewer is a portal, and React bubbled its presses and right-clicks to the message behind it, whose menu opened under the photo. The viewer now handles its own events and has its own menu (Download, Copy image, Open in a new tab) | `chat/MediaViewer.tsx` |
| Video viewer like the reference (later photo 1) | Photos and videos share one viewer: who sent it and when at the top left; Download, Open in a new tab and More at the top right; arrows and a strip of the message's other photos and videos; videos play with Meldiq's controls (play, time, seek, volume, full screen; Space plays/pauses). Videos in a message are a tile with a play button | `chat/MediaViewer.tsx`, `Attachments.tsx`, `blobUrl.ts` |
| Hold and drag communities, folders (photos 5–7), same for channels | Drag with the mouse, or hold a finger then drag (a quick swipe still scrolls). Drop onto a community: a folder; onto a folder: into it; between: reorder; out of a folder: out. A closed folder shows up to four of its communities and their mentions; open, a tinted column. Right-click a folder: rename, colour, ungroup. The order and folders sync with the account's other devices (API 0.50.0 `railFolders`). People who manage channels drag channels (within or between categories, or onto a category) and categories | `components/dragSort.ts`, `sync/railFolders.ts`, `shell/Rail.tsx`, `RailFolder.tsx`, `RailCommunity.tsx`, `community/CommunityPanel.tsx`; API `preferences/` |
| Dark by default, and a black theme | Dark is the default (the old default "system", never picked, moves to dark; a theme someone picked stays). New **Black** theme: true-black surfaces with any palette | `application/prefs.ts`, `styles/tokens.css`, `PreferencePages.tsx`, `ProfileMenu.tsx` |
| Typing: names, "meldling" (photos 8–9) | Three bouncing dots, then "**Kofushi** and **Rea** are meldling"; the list row says "Bob is meldling…" | `chat/TypingIndicator.tsx`, `ConversationRow.tsx` |
| Messages home like the reference (photos 10–11) | Friends: Online, All, Pending (accept, decline, cancel), Blocked (unblock), Suggested (people from your communities, worked out on this browser), Add Friend by username | `views/FriendsView.tsx`, `/friends` |
| Voice/video/screen-share marks (photo 12) | A live call shows on the community's rail icon (green speaker; red while someone is live), on the channel with how long it's been on, and "LIVE" beside who is sharing | `shell/RailCommunity.tsx`, `components/LiveCallBadge.tsx`, `ui/selectors.ts` |
| Call screen like the reference (later photo 2) | On a desktop window the call fills the middle and the channels stay usable; "Voice/Video Connected" with the channel, community and time sits at the foot of the channel list with camera, screen share, invite and disconnect; screen shares carry a LIVE badge; voice channels have "Invite to voice". Phones keep the full-screen call | `call/CallStage.tsx`, `ConnectedCallPanel.tsx`, `ShareViews.tsx`, `styles/call.css` |
| A livelier community (photos 13–14) | The community's banner sits behind its name at the top of the channel list; member rows carry a nameplate in the person's own name colours | `shell/Sidebar.tsx`, `chat/PeoplePanels.tsx`, `styles/community.css` |
| "Workspace" still showing (photo 15) | Every "workspace" people read is now "community" (English, Chinese, Bengali); branches/teams wording dropped from the leave and remove texts | ~25 files under `src/ui` |

Not done, and why: the reference's "Choose Activity", soundboard and Nitro-style perks (no such features exist in
Meldiq to wire them to); a folder can't be made from the keyboard (dragging only; the communities' menus still move them).

## Checks

| Check | Result |
|---|---|
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests | 530 passed, 1 skipped (new `rail-folders`, theme defaults) |
| API `tsc`, full suite | 979 passed, 10 skipped (new rail folder tests) |
| New browser tests (`owner-round-1028`) | Friends tabs and accepting a request; a folder made by dragging, kept after a reload, opened; a photo's right-click cancelled for Meldiq's menu with Download/Copy, the viewer above everything with its own menu; Black theme |
| Full browser suite, Chromium desktop and phone width | 70 passed on the first run; 2 failed on expectations of the old defaults (the Messages home's old heading, the light rail colour), updated and passed |
| Calls with real encrypted media (native LiveKit peer, `ORBIT_GRIIP_BOT_DIR`) | calls, voice room, other device, screen shares: 19 passed across desktop and phone width, after moving the new LIVE badge off the shared screen's full-screen button (it covered it) |
