# Meldiq stage 1 (2026-10-28): report

From the owner's screenshots of 2026-10-28 (stage 1: everything that needs no outside accounts or business decisions).
API **0.46.0** (meldiq `stage1-api`) and Meldiq Web (meldiq-web `stage1`). Names are Meldiq's own; no other product's
logo, colours or wording.

## What changed

| Area | Result | Main files |
|---|---|---|
| Right-click menus | One community menu for the rail icon, the header and the channel list's empty space: mark as read, invite, **mute** (15 min to "until I turn it back on", synced: `community.mutedUntil`), notification level and Ignore @everyone (submenu), hide muted, show unread, community settings (submenu), privacy, create channel/category/event, join, leave, copy name; Copy ID in Builder mode. Home and Create menus on the rail. Menus have submenus, checkboxes and hints, and take the focus once placed. The browser's menu stays only on text fields, selected text, links to other sites and message media | `ui/components/Overlay.tsx`, `ui/community/communityMenu.tsx`, `ui/shell/Rail.tsx`, `Sidebar.tsx` |
| User panel | Your banner behind you; microphone and headphones with device menus (outside a call: join muted or deafened); Settings. Activity moved to the profile menu | `ui/shell/UserPanel.tsx` |
| Voice & Audio | Microphone and speaker, output volume, mic test, voice activity or **push to talk** (choose the key), noise suppression, echo cancellation, automatic gain, join muted; all reach calls | `ui/settings/CallsPage.tsx`, `call/manager.ts`, `call/livekitSession.ts`, `ui/call/usePushToTalk.ts` |
| Name styles and tags | 6 fonts (OFL: Silkscreen, Press Start 2P, Pacifico, Bungee, Orbitron, plus monospace), 12 colour presets or your own 2–3 colour gradient, glow or shimmer; a community's 2–4 letter **tag** members wear by their names. Shown in messages, member lists, DMs, the profile card, the user panel | `ui/people/NameStyle.tsx`, `ui/settings/NameStyleCard.tsx`, `ui/workspace/TagCard.tsx`, `public/fonts/names` |
| Animated avatars | Everywhere a person appears (lists, messages, DM rows, rail bubbles), not only the profile card | API member views; `LookAvatar` |
| Invitation page | The community's own icon; Get Meldiq for Android (Play Store); Open in the app only on Android | `public/invite.*`; API `GET /v1/invites/:code/photo` |
| My Account | Card with banner, avatar, Edit profile; display name, username and email (hidden until Reveal), each with Edit; **change email** with a code; password; **two-step sign-in** (authenticator app, QR code, 10 backup codes; sign-in and re-sign-in ask for the code); passkeys, key backup, recovery codes; **account standing**; **bug hunting**; **download your data**; sessions; **log out everywhere**; delete account | `ui/settings/AccountOverview.tsx`, `AccountSafetyCards.tsx`, `AccountExtrasCards.tsx`, `sync/accountSafety.ts`, `sync/dataExport.ts` |
| My Profile | About me (300), up to 5 links (https), name style; the profile card shows them and the Bug Hunter badge | `ui/settings/ProfilePage.tsx`, `ui/people/ProfileDialog.tsx` |
| Appearance | **Colour themes**: 20 gradients or your own 2–3 colours, with strength; use a community's own colours (switch); message bubbles on the rail (switch) | `application/vibes.ts`, `ui/settings/AppearanceExtras.tsx` |
| Shortcuts | Change or turn off each shortcut (quick switcher, previous/next and unread conversations, mark community read, mute and deafen in a call, the list); ⌘/ shows them all | `application/shortcuts.ts`, `ui/settings/ShortcutsPage.tsx`, `ui/dialogs/ShortcutsDialog.tsx` |
| Advanced | Builder mode (Copy ID on communities, channels, messages, people); trusted sites | `ui/settings/AdvancedPage.tsx`, `ui/chat/SafeLink.tsx` |
| Settings layout | User settings (My Account, My Profile, Privacy & security, Devices) and App settings (Appearance, Voice & Audio, Notifications, Shortcuts, Advanced, Storage, About) | `ui/settings/SettingsView.tsx` |

## Server (API 0.46.0)

Migrations **059** (`orgs.tag`) and **060** (five tables, two nullable `users` columns); additive only. Details:
meldiq `docs/PROFILE_MEDIA.md` (name styles, tags, list media, community mute, invite icon) and `docs/ACCOUNT_SAFETY.md`
(two-step sign-in, email change, standing, bug reports, About me and links). Staff tools are operator CLI commands:
`admin.js warn | warnings | unwarn | bug-reports | bug-report`.

**Standing is enforced**, not just shown: 1 active warning blocks starting communities and invitations, 2 also block new
conversations and joining communities, 3 also block sending messages.

## Known limits

- **Android and two-step sign-in**: the Android app can't send the code yet, so with two-step on, password sign-in on
  Android fails until the app supports it (signed-in devices stay signed in). The web says so before it's turned on.
- **Download your data** is built in the browser from its own copy (messages are end-to-end encrypted): messages from
  before the browser was set up aren't in it.
- Left out on purpose: "Suggest me to people with similar interests" (Meldiq has no suggestions feature yet); a
  soundboard volume (no soundboard); "edit your last message with ↑" (no such feature yet).
- Staff review bug reports and warnings with the CLI; the admin console doesn't show them yet.
