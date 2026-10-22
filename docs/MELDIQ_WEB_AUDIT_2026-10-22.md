# Meldiq Web audit (2026-10-22, before release)

Scope: everything on this round's branch that wasn't on `main`: 155 files, about 11,500 lines added
(batches B1–B16, the merge of `main` and the B14 room page and details actions). It was run before the push and the
production deploy, at the owner's request.

## How it was done

- A code review of the whole range for correctness, removed behaviour, call sites, reuse, simplification and efficiency.
  No CLAUDE.md applies to this repository.
- A security pass:
  - every new API path builds its ids with `encodeURIComponent`
  - message and invite links are matched against fixed patterns and carry ids only; an invite link only opens Join with
    the code filled in
  - new payload fields (`title`, `tags`, `customEmoji`, `customSticker`) are length-limited by the schema and cleaned
    again before they're stored
  - `:name:` reactions are accepted only in community channels
  - community emoji images are shown only when the downloaded bytes match the SHA-256 the message names
  - uploads are checked for type and size and shrunk on this device
  - no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, debug logging, secrets or credentials were added
  - permissions stay on the server: the web only hides what the server would refuse
- Tests after the fixes, against both the local server copy (0.24.0) and **production's server version (0.25.0, Android
  commit `22d5303`)**: the full `vitest` suite, and Playwright calls and voice room in Chromium.

## Findings and what was done

| # | Severity | Where | Finding | Outcome |
|---|---|---|---|---|
| 1 | Medium | `CallsPage.tsx` | Stopping the microphone and camera check (or changing a device) while devices were being listed left an AudioContext and a meter loop running | Fixed |
| 2 | Medium | `CallsPage.tsx` | The check needed a camera; a computer without one couldn't test its microphone | Fixed: microphone alone, with a note |
| 3 | Medium | `VoiceRoomView.tsx` | Invite people opened the *selected* community's invitations, which could be another community | Fixed: selects the channel's community first |
| 4 | Medium | `ConversationDetails.tsx` | Details kept the previous conversation's tab (a DM could show a group's Members tab) | Fixed: keyed by conversation |
| 5 | Low | `expressions.ts` | A failed emoji image download was remembered until reload | Fixed: retried; a wrong hash is still refused |
| 6 | Low | `Composer.tsx` | A community sticker didn't start the slowmode countdown | Fixed |
| 7 | Low (efficiency) | `ForumView.tsx` | Every new message reread 2,000 forum messages | Fixed: one reload after a burst |
| 8 | Low (efficiency) | `CallsPage.tsx` | The level meter re-rendered the card every frame | Fixed |
| 9 | Low (a11y) | `DetailsTabs.tsx` | A note was placed inside a list | Fixed |
| 10 | Low | `ConversationDetails.tsx` | A members error stayed after a later successful load | Fixed |
| — | Test | `live-nav.test.ts` | The test raced the unread count (failed once under load) | Fixed: it waits for the count |

No critical or high findings, and no security findings.

## Results after the fixes

- Against 0.25.0: `vitest` **84 files, 492 passed, 21 skipped, 0 failed**; Playwright `calls.spec.ts` and
  `voice-room.spec.ts` in Chromium (local LiveKit, the native call peer from the same commit): **7 of 7 passed**.
- Against 0.24.0 (the local copy): the same e2e, **7 of 7 passed**.
- `tsc -b`, `eslint`, `npm run format:check`: clean.

## Not covered by this audit

- Physical phones, Safari and Firefox by hand, and a 1 GiB upload on a real network.
- The server's own code (only its behaviour, through the tests).
- What the parity matrix lists as not built (timeline media sizing, camera choice in a call, languages, Web Push).
