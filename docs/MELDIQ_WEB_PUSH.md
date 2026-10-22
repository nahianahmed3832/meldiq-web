# Meldiq Web notifications (2026-10-22)

How the web app notifies, why it didn't work reliably before, and what turns background notifications on in production.

## 1. What was wrong (audit, 2026-10-22)

| Finding | Effect |
|---|---|
| Only the page notified (`new Notification()` from the live connection). No service worker, no push subscription, no token sent to the server. | Nothing arrived once the tab was closed, and often not after the browser froze a background tab and its connection dropped. |
| The in-app **Desktop notifications** switch defaulted to off, and its stored copy was always `false` until switched on in Meldiq. | Permission granted in the browser's site settings (or by an earlier prompt) did nothing. This matches the report: "even when permission was granted". |
| Every notification of a conversation used the same tag, without `renotify`. | A second message in the same conversation silently replaced the first: no sound, no banner. |
| Clicks were handled by the page that created the notification. | A click after the tab was discarded did nothing. |

The server side was already in place: the Android app's Firebase wake-ups (`docs/PUSH_FCM.md` in the server repository).
Production runs API 0.25.0 with `push-fcm`. A device registers its own token (`PUT /v1/devices/current/fcm`); when
something is queued while that device has no open connection, or a call rings, the server sends it a content-free
`{"w":"1"}`. A linked browser is a device of its own, so it fits as it is: **no server change**.

## 2. How it works now

```
server ──{"w":"1"} (Firebase, no content)──▶ browser push service ──▶ service worker (/sw.js)
   ▲                                                                     │ Meldiq page in front? tell it to reconnect
   │  GET /v1/queue (not acknowledged), /v1/conversations,               │ otherwise: sign in as this browser
   └──── /v1/users/me, /v1/me/preferences/:id ◀─────────────────────────┘ (its device key, like the page)
                                                                         ▼
                              one notification per conversation / ringing call → click opens that conversation
```

- **Page** (`src/application/webPush.ts`, `src/application/boot.ts`): notifies as before, now through the service worker's
  `showNotification` with `renotify`. A click works even after the tab is gone, and so does Chrome on Android.
  - The Desktop notifications switch follows the site's permission until the person chooses (`notifyChoice`).
  - The page copies the few choices the worker needs into its own IndexedDB (`meldiq-sw`).
  - A wake-up message from the worker makes the page reconnect now.
- **Service worker** (`src/sw/sw.ts`, built to `/sw.js`; development serves the source as a module):
  - A Meldiq page is in front: it tells the page and shows nothing.
  - Otherwise it signs in as this browser and reads what's waiting **without acknowledging it** (the app still fetches
    everything when it opens).
  - It shows what `src/sw/wakeRules.ts` decides. These are the app's own rules: notification levels, timed mutes,
    category and community levels, Ignore @everyone, paused notifications, group notifications, and message requests
    (they never notify).
  - Reactions, edits and receipts never notify. One notification per conversation ("2 new messages"); a later wake-up
    replaces it.
  - A call ringing from someone else shows as "Incoming voice/video call". A call you started on your phone doesn't.
  - Message text is never shown in the background: it's end-to-end encrypted and only the app decrypts it. With
    "Show message text" off, the title is "Meldiq" too.
  - If the server can't be reached: "Something new is waiting for you".
- **Registration** (`registerPush`):
  - On the person's click in Settings › Notifications › When Meldiq is closed, after the permission prompt (only ever
    asked from the Desktop notifications switch).
  - Firebase issues a token for this browser and it's registered for this device.
  - At each start it's registered again if the token changed, the device changed, or a day passed. The server drops
    tokens that fail for a week, and removes them with the device on sign-out.
  - "Turn off on this browser" deletes the token on both sides.
- **Android is unaffected**:
  - Same endpoints, one token per device.
  - Registering a token removes that same token only from other devices, so a browser never replaces a phone's.

### States shown in Settings

Unsupported browser · not https · server doesn't offer it · not set up for this site · notifications blocked ·
permission needed · Desktop notifications off · turning on · failed (with the reason) · ready to turn on · on.

## 3. Turning it on in production (owner, free, Firebase project `meldiq`)

1. **Web app:** Firebase console › Project settings › General › Your apps › Add app › Web (e.g. "Meldiq Web").
   - No hosting is needed.
   - Copy `apiKey`, `projectId`, `messagingSenderId` and `appId` (`1:…:web:…`).
2. **Web Push key:** Project settings › Cloud Messaging › Web configuration › Web Push certificates › Generate key pair.
   - Copy the public key (`vapidKey`).
3. **Settings file:** put the five values in a JSON file on the VPS, e.g. `/root/meldiq-web-firebase.json`. None of them
   is a secret:

   ```json
   { "apiKey": "…", "projectId": "meldiq", "messagingSenderId": "…", "appId": "1:…:web:…", "vapidKey": "B…" }
   ```

4. **Install:** install the next release with `MELDIQ_FIREBASE_CONFIG=/root/meldiq-web-firebase.json` added to the usual
   command (`ORBIT_WEB_DEPLOYMENT.md` §4). It writes the `firebase` block into `config.json`, and lets the page reach
   `firebaseinstallations.googleapis.com` and `fcmregistrations.googleapis.com` (CSP).
5. **API key restrictions:** if the project's browser API key is restricted, allow `https://web.meldiq.app/*`, plus the
   Firebase Installations and FCM Registration APIs.

Without steps 1–4, Settings says "not set up for this site" and notifications work while a tab is open (now reliably).

## 4. Browsers

| Browser | Background notifications | Notes |
|---|---|---|
| Chrome, Edge (desktop) | Expected to work | Their push service is Google's (FCM). Not tested with real Firebase delivery yet (no web app configured) |
| **Brave** (the reported browser) | Off until the person allows it | Brave turns Google's push service off by default. Settings › Privacy and security › **Use Google services for push messaging** must be on; Settings says so if registering fails |
| Firefox (desktop) | Expected to work | Firebase supports it; not tested |
| Safari 16.4+ (macOS) | Expected to work | Not tested. iPhone/iPad only when Meldiq is added to the Home Screen |
| Chrome on Android | Expected to work | Page notifications now go through the service worker (Android has no `new Notification`) |
| Mainland China | Needs a VPN | Browsers' push services are Google's or Mozilla's, as for the Android app (`PUSH_FCM.md`) |

## 5. Limits

- A wake-up for something that ends up showing nothing (e.g. a muted conversation) is a silent push. Chrome allows a
  few, then may show its own "This site has been updated in the background".
- "Mentions only" can't see a mention by name in the background (it's inside the encrypted message). @everyone and
  @here notify; the rest shows when the app opens.
- A call notification brings you to the conversation; it can't answer the call by itself. If the call ended meanwhile,
  the conversation simply opens.
- Ordinary wake-ups are paced by the server (at most one per `FCM_WAKE_INTERVAL_SECONDS`, 30 s, per device); calls
  don't wait.

## 6. How it was checked (2026-10-22)

- Unit tests:
  - `wake-rules.test.ts`: who, what and when the worker shows.
  - `push-rules.test.ts`: the Settings states, re-registration, and the permission-follows bug.
  - `config.test.ts`: Firebase settings, refusing an Android app id.
- Browser tests, Chromium against the real server (0.25.0), `e2e/notifications.spec.ts`. The wake-up is delivered
  through Chromium's DevTools protocol, as Firebase would deliver it:
  1. With Meldiq closed, two messages show "Bob Chen · 2 new messages", without text; the click opens the DM.
  2. A muted DM shows nothing, and with Meldiq in front nothing is shown on top of it.
  3. A ringing call shows "Incoming voice call".
- `install-release.sh`'s config writing, checked with and without a Firebase file.
- **Not checked:** real delivery through Firebase and a browser's push service, because there's no Firebase web app yet
  (steps 1–2). Not checked either: Brave, Firefox and Safari by hand, a phone's browser, or production.
