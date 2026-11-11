# Physical keyboard qualification — pending

Status: **Blocked on device access**. No Android hardware was reported by `adb devices -l`; the known iPhone 16 was unavailable in `xcrun devicectl list devices`. OS and browser versions could not be read. Desktop WebKit and phone-sized Playwright tests do not qualify a physical keyboard or installed PWA.

Run against the exact candidate export identified in `RELEASE_READINESS_2026-11-11.md`, using the intended API revision and disposable accounts. Serve it on an authorized HTTPS test origin accessible to the devices; `127.0.0.1` on a phone refers to that phone. Keep production accounts and data out of the test. Do not publish the candidate to production for this checklist.

Record before each run:

| Field | Result |
| --- | --- |
| Tester / date | Pending |
| Device model | Pending |
| OS version | Pending |
| Browser and version | Pending |
| Mode: browser / installed PWA | Pending |
| Test origin | Pending |
| Candidate commit / Next build ID | Pending |
| API revision / version | Pending |
| UI language / keyboard language | Pending |
| Overall pass / fail and issue reference | Pending |

Use Safari on a physical iPhone and Chrome on a physical Android phone. Also repeat in the installed PWA when installation is supported and available. Record unavailable modes explicitly.

1. **Setup.** Create disposable email accounts A and B through ordinary signup, verification, encryption setup and welcome. Use a second client as a conversation peer. Open `/friends`, tap **New message**, find the peer and open the conversation. Record the actual canonical `/dms/<numeric-id>` URL shown by the app. Send one message and confirm the peer receives it.
2. **Compose with the keyboard open.** On that conversation URL, type several lines, including an emoji. Scroll the history, return to the composer and tap **Send** without dismissing the keyboard. Expected: the composer and Send remain reachable, message appears once, entered text is not obscured or lost. Dismiss and reopen the keyboard; focus and scroll recover without leaving an empty gap or hiding the latest message. Result: ___
3. **Later search.** Save a message through **More actions → Save for later** and open `/later`. Type part of its text into **Search saved messages**, scroll while the keyboard stays open, change **Show** and **Collections**, and use **Clear filters**. Expected: usable labels/controls, matching result, cleared search remains focused, no horizontal overflow. Follow the saved item, go Back, and reload; the account's filters restore. Result: ___
4. **Create collection.** On `/later`, open **New collection** with the keyboard visible. Try whitespace, then a valid long name (up to 60 characters). Expected: blank/whitespace cannot submit; field, Save and close control are reachable, validation does not push controls out of reach. Save successfully, assign the saved item, select the collection and open **Rename collection**. Result: ___
5. **Rename and recover.** Enter a new name, disable network connectivity on the phone, then submit. Expected: an error is shown and the entered name remains. Reconnect and retry once. Expected: one renamed collection, no duplicate, dialog closes and focus returns to its trigger. Dismiss the keyboard and verify normal scrolling. Repeat with dialog cancellation. Result: ___
6. **Offline send.** Keep the conversation open, disconnect network, type and send a disposable message. Expected: visible sending/pending state; no false success. Reconnect without closing the tab; confirm one peer receipt and one message after reload. This checks the existing in-session retry contract; it does not promise new background or cross-restart delivery. Result: ___
7. **Long and RTL copy.** In `/settings/language`, choose German, then Arabic or Urdu. Repeat Later search, New/Rename collection and keyboard dismissal. Expected: readable wrapped text, correct direction, no clipped controls; user-entered message/collection text is unchanged. Older untranslated labels may fall back to English; record them separately from the new refresh strings. Result: ___
8. **Account boundary.** Add account B using account switching in `/settings/you`. Open `/later`: A's messages, collection and search must not appear. Save a different item as B and set a different filter. Switch back to A; its own view restores. Log out A from `/settings/you`, confirm B stays signed in with only B's view/content, then reload. Result: ___

Record any issue with the step, expected/actual result, orientation, keyboard state and sanitized screenshot. Never attach a recovery key, verification code, token, real message or private search. After a fix, repeat the failed step and the related compose/dialog recovery steps on the same device and build. Qualified native-language review is a separate pending activity.
