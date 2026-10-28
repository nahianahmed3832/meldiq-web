# Meldiq Web: chats survive signing out (2026-10-28)

The owner reported that after "Sign out and erase this browser", all chat history was gone from the browser. It
should be there again at every sign-in. The same report flagged a decoration ring drawn through an avatar's presence
dot.

## What was wrong

- **Only phones wrote to the history.** The account's encrypted history on the server (server
  `docs/MESSAGE_HISTORY.md`) was written only by phones; browsers only read it.
  - A browser restored at sign-in whatever the phone had uploaded. Anything else, such as a web-only account or a
    phone that is away, not updated or not running, existed only in that browser's IndexedDB.
  - Signing out erases that IndexedDB, so those chats were lost.
  - In the owner's case, the history held their chat with fardin only up to Sunday. A browser that kept its copy (the
    in-app browser pane) still had the chat up to today.
- **The button's name described the erasing, not what the person wanted.** It was called "Sign out and erase this
  browser".

## What changed

| | |
|---|---|
| Browser backup | `sync/historyUpload.ts` (`HistoryUploader`) queues every message written to the local store (`LocalStore.onMessagesWritten`). It seals each one in the phone's own format (`protocol/history.ts` `encodeHistoryRecord`, `crypto/history.ts` `sealHistoryItem`) and sends them with `PUT /v1/history/items`, in batches like the phone's (150 items or 3 MB). It asks the server to keep the files of messages from the last 7 days. A first run queues everything the browser already holds. The queue survives a reload. Failures are retried with backoff (30 s, up to 15 min). Messages restored from the history aren't sent back, and a read receipt on its own doesn't send a message again. |
| Keys | History keys are now derived with `encrypt` as well as `decrypt`. They are still non-extractable, still use a random nonce per item, and are still bound to the account and tag. A browser set up before this change has a decrypt-only key, because it no longer has the seed. **Settings › Privacy & security › Chat history › Back up this browser's chats** opens the seed once, with the key backup (password plus an emailed code) or the recovery key. The browser derives keys that can write, then wipes the seed (`Engine.unlockHistoryBackup`). |
| Sign out | Called **Sign out** everywhere: the security page, the profile menu and the Sign in again screen. It backs up first (`backUpBeforeSignOut`), then leaves the account and removes the keys and the local copy. If the backup can't be sent (offline, or keys set up before this change), it asks first, offering "Try again" or "Back up first", and "Sign out anyway". "Log out everywhere" backs up first too. |
| Restore | The **Chat history** card shows the backup status and has **Restore chats from the server**, which reads the whole history again and adds what is missing. Every sign-in still restores automatically. |
| Avatar frames | The frame is drawn before the avatar, so the presence dot sits over it instead of being cut through. Its thickness is set for the avatar's size (`decorationWidth`, 2–6 px) and it sits wholly outside the face. At 36 px the old 6 px ring overlapped the face by 3.5 px. |

The server is unchanged: browsers use the same history routes phones already use (`PUT /v1/history/items`,
`POST /v1/attachments/:id/keep`). The server sees only ciphertext under opaque tags.

## Getting the owner's chats back

1. In a browser that still has the chats (the owner's in-app browser pane has the chat with fardin up to today), open
   Settings › Privacy & security › Chat history and choose **Back up this browser's chats**. Enter the emailed code and
   the password. That browser then uploads everything it holds.
2. The browser that was signed out restores the new items when it next loads, or at once with **Restore chats from the
   server**.

Chats that existed only in the erased browser and were never in the history can't come back: they were encrypted
for that browser's keys alone, and those keys were erased.

## Checks

| Check | Result |
|---|---|
| `tsc -b`, `eslint .`, `format:check` | clean |
| Unit tests | 540 (539 passed, 1 skipped). New: `test/history-backup.test.ts` (10). These cover: items the phone's algorithm opens; record round trip, with no nulls in the phone's row format; settled messages only; keys from before can't write; backfill and every later write; restored items not sent back; receipts alone not sent again; files kept; offline then retried; the queue surviving a reload |
| Browser (`e2e/history-backup.spec.ts`) | A browser-only chat is backed up, signed out with the new dialog, signed in again as a new device, and both messages are back |
| `e2e/cross-device.spec.ts` | Updated for the new button. Its settings address was an old `/#/` route that never reached the page; now `/settings/security` |
