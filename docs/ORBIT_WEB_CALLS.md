# Orbit Web: voice and video calls (2026-10-18)

How the browser takes part in Orbit calls, and how it interoperates with the Android app. The call lifecycle, the
reachability rules and the encryption model are the Android app's (`CALLING_AND_E2EE.md`); this page records what the
browser does the same way, what it does differently, and the evidence. Status: `ORBIT_WEB_STATUS.md` › Calls.

> **Not yet supported.** Everything below is built and tested in Chromium, Firefox and WebKit against a real server,
> a real LiveKit media server and LiveKit's native SDK. It has **not** been run between a browser and the Android app on
> a physical phone. Until that test (§8) has passed with the owner, browser calls are not called supported.

## 1. What the browser uses

| Part | What | Changed? |
|---|---|---|
| Call API | `POST /v1/calls`, `/join`, `/connected`, `/alerted`, `/decline`, `/end`, `/leave`, `GET /v1/calls/:id`, `GET /v1/calls/active` | No server change |
| Realtime | `call` frames (`ring`, `started`, `updated`, `alerted`, `declined`, `dismissed`, `ended`) and `queue.drained` | No server change |
| Media | Self-hosted LiveKit SFU through `livekit-client` **2.22.3** (pinned exactly) | — |
| Media key | `call_invite` / `call_key_request` controls inside griip-envelope-v1, as the Android app sends them | No protocol change |

No gap was found that needed the backend, so there is **no server change, migration or new endpoint** for calls.

## 2. Code

| Path | What |
|---|---|
| `src/call/manager.ts` | `CallManager`: one call at a time; ringing, answering, placing, joining a running call, declining, busy, hang-up, ring recovery, key wait and key requests, rejoin after a dropped connection, the 1:1 peer-drop grace (android `CallManager`) |
| `src/call/callKeys.ts` | Key generation (32 random bytes, base64), the creator-only rule (T5.2), first-key-wins key ring (memory only, 64 calls), request pacing (T5.3), the verification code (android `CallVerification`) |
| `src/call/livekitSession.ts` | The LiveKit room: E2EE, devices, tiles, stats, events. Loaded only when a call starts (`media.ts`) |
| `src/call/e2eeWorker.ts`, `frameAudit.ts` | LiveKit's E2EE worker plus Orbit's frame audit and plaintext guard (§4) |
| `src/call/security.ts` | The badge rule D-17 (android `MediaSecurityTracker`), fed by the frame audit |
| `src/call/rules.ts` | Ring recovery, retryable disconnects and backoff, media-flow monitor, network path, failure messages |
| `src/ui/call/` | Incoming-call card, call stage, minimised bar; call buttons and "Join" in the conversation header and banner |
| `src/sync/outbox.ts` › `sealAndPost` | Seals and posts a control without storing it (used for the key, §3) |

## 3. Keys

- **Placing a call:** the browser makes a fresh 256-bit key (`crypto.getRandomValues`, base64 like Android's
  `randomBytes(32).b64()`), keeps it in memory and sends it in a `call_invite` control to every device of the
  conversation, the account's own phone included.
- **Never stored.** The `call_invite` is sealed and posted directly (`Engine.sendControlNow`), not through the outbox,
  because the outbox lives in IndexedDB. Received keys live in `CallKeyRing` in memory. A test reads every IndexedDB
  store after a call and checks the key isn't there (`test/call-live.test.ts`). A tab reload forgets keys; a call
  joined after a reload gets its key again with `call_key_request`.
- **Accepting a key (T5.2):** only from the call's creator, in the call's own conversation, for a call that hasn't
  ended, checked against `GET /v1/calls/:id`; the envelope signature already proved the sender. The first accepted key
  wins. Keys that aren't base64 of 32 bytes are refused.
- **Late joiners (T5.3):** without the key 1.5 s after asking to join, the browser sends `call_key_request`, then at
  most every 5 s. The creator's devices (the browser too, for calls it started) answer each call at most every 5 s,
  only in the call's conversation and only while the call is live.
- **No key, no call:** after 10 s without the key the browser refuses to join ("Couldn't get this call's encryption
  key…"). There is no unencrypted fallback and no setting to turn media encryption off.
- **The LiveKit key:** the key *string* is LiveKit's shared key. livekit-client derives the AES-128-GCM frame key with
  PBKDF2-SHA-256 (100,000 rounds, salt `LKFrameEncryptionKey`) from the string's UTF-8 bytes, which is what the Android
  SDK's `setSharedKey(String)` and LiveKit's native SDKs do. Key index 0, no ratcheting, as on Android.
- **Verification code:** the badge opens the call's four emoji and six digits, HKDF-SHA256 over the key and the call id
  exactly as `CallVerification` computes them; checked against an independent implementation on Node's HKDF.

## 4. The badge (D-17) and the plaintext guard

LiveKit's web SDK reports frame-encryption *failures*, never successes, and decides per participant whether to decrypt
from what the media server says about their tracks. So Orbit runs LiveKit's own E2EE worker inside a small wrapper
(`e2eeWorker.ts`) that sits on both sides of LiveKit's frame cryptor:

- **Evidence.** For each track it compares every frame before and after the cryptor (`frameAudit.ts`). A received frame
  that went in ending with LiveKit's trailer and came out at least 30 bytes shorter (16-byte AES-GCM tag + 12-byte IV +
  2-byte trailer) was authenticated and decrypted with this call's key; frames that fail aren't passed on at all. An
  outgoing frame that grew by at least that much and ends with the trailer was encrypted. Counts go to the page twice a
  second.
- **Rule D-17** (`security.ts`, the Android tracker's rules and test cases): "End-to-end encrypted" only when every live
  track, published or received, has proven itself and at least one is remote; "Encryption problem" when a current track
  has frames arriving that don't decrypt, or LiveKit reports an encryption error for that person; otherwise "Verifying
  encryption…". A tile shows who has the problem.
- **Plaintext guard.** Every participant is treated as encrypted whatever the server says, and a frame that would cross
  the cryptor unencrypted is dropped, in both directions. Empty frames (silence) and the media server's own
  silence/black frames (LiveKit checks their payload) pass, and never count as proof.
- **Nothing plays before it's proven.** Someone's audio is attached to the speaker, and their video to the screen, only
  once the audit has seen that track decrypt with the call key (a tile shows the avatar until then, about half a
  second). Found by the wrong-key browser test: Firefox can hand a track's first frames to the decoder before LiveKit
  attaches its decrypt transform, and a VP8 keyframe keeps its first 10 bytes (with the picture size) unencrypted, so the
  video learned the peer's resolution from ciphertext. That window could also carry frames a malicious media server
  injected. With this rule nothing from that window is ever shown or heard; with a wrong key nothing is, ever.
- **Better than required in one place:** with a wrong key, Android shows "Verifying encryption…" (its SDK drops failing
  frames silently); the browser sees frames arriving that don't decrypt and shows "Encryption problem".

The wrapper depends on how livekit-client 2.22.3 talks to its worker (message kinds `enable`, `encode`, `decode`,
`setSifTrailer`, `updateCodec`, and `onrtctransform`). That's why the version is pinned exactly; the browser tests fail
if an upgrade changes it.

## 5. Calls in the interface

- **Ringing:** a card at the top right (full width on phones) with Decline, Answer and, for video calls, Voice only; a
  soft Web Audio ring (silent if the browser blocks sound before the first click) and a system notification when the
  tab isn't looked at. The caller sees "Ringing…" once the browser rings (`/alerted`).
- **Placing:** voice and video buttons in the conversation header. They're disabled, with the reason, when the server
  has no calling, the browser can't encrypt media, the conversation is archived or read-only, or a call is running
  (then "Join" in the banner).
- **Call stage:** names and tiles (video or avatar, muted, weak connection, encryption problem), status ("Calling…",
  "Ringing…", "Getting the call's encryption key…", "Connecting…", the timer, "Reconnecting…", "Reconnecting media…"),
  the badge and verification code, Mute, Camera, Hang up, and Minimise (a bar that keeps the call while you chat).
- **Permissions:** the browser asks for the microphone (and camera) when you place or answer a call. Placing a call
  without a microphone is refused before anyone rings. Answering without one connects listen-only. Each refused or
  missing device gets a banner ("Orbit isn't allowed to use your microphone. Allow it in your browser's site settings…",
  "No camera was found…", "…in use by another app or tab…") with Try again.
- **Sound blocked by the browser:** "Your browser paused the call's sound" with Turn on sound.
- **Connection:** LiveKit's own reconnect first ("Reconnecting…"); if it gives up for a connection reason, the browser
  gets new credentials and rejoins with the same key for up to 45 s (1, 2, 4, then 6 s apart). In a 1:1 call, if the
  other person drops, it waits 30 s for them. A TCP-only path gets a note. Closing the tab mid-call ends or leaves the
  call on the server at once (keepalive request).
- **One call at a time:** a second 1:1 ring is declined as busy. Group calls ring and can be joined from the banner.

## 6. Tests

| Where | What |
|---|---|
| `test/call-keys.test.ts` (11) | Key format and refusal of malformed keys; creator-only acceptance (T5.2); first key wins; bounded ring; request and answer pacing (T5.3); verification code equal to an independent HKDF implementation and to RFC 5869 test case 1; frame-audit verdicts (decrypted, encrypted, unchanged, empty, server-injected, unseen frames) |
| `test/call-rules.test.ts` (22) | D-17 badge: the cases of android `MediaSecurityTrackerTest` plus wrong key, slow start, unencrypted frame, LiveKit error, injected frames; ring recovery; retryable reasons and backoff; media flow; network path without addresses; failure messages; device-error classes; the call screen's status lines |
| `test/call-live.test.ts` (19) | Against an in-process server with reference clients (byte-compatible with Android) and a recording fake for media: ringing and `alerted`, joining with the caller's key, `ACTIVE` state, hang-up; refusing to join without a key (and asking for it); getting it by `call_key_request`; T5.2 in a group; decline; listen-only with refused devices; ringing stops when the account's phone answers; ring recovery after reconnecting; placing a call (key format, the account's phone gets it too, call entry, **key absent from IndexedDB**); answering key requests only as the creator; hanging up while the call is being created leaves nothing ringing; no call without a microphone; busy; rejoin with the same key; removal ends the call; 1:1 peer drop and return; stopping from a state listener can't loop; a browser that can't encrypt |
| `e2e/calls.spec.ts` (5 × 4 projects) | Real browsers, real LiveKit, real E2EE against LiveKit's **native** SDK (libwebrtc's frame cryptor, the Android SDK's implementation family): an incoming video call verified encrypted both ways (remote video playing, the native side hearing the browser), verification code; an outgoing voice call, mute, hang-up from the other side; a wrong-key peer shown as "Encryption problem", nothing rendered, the native side hearing nothing; a refused microphone (no call placed; an answered call listen-only); a network drop and recovery (Chromium, and Chromium at phone width) |

Results on 2026-10-18 (Node 25.8, Playwright 1.64.1, LiveKit 1.13.10): unit and integration 141 passed; browser tests
29 passed, 3 skipped (two network-drop cases outside Chromium, one desktop-only test). Before the badge work could be
trusted, a spike checked the encryption itself across engines: with the right key every frame from the native peer was
verified as decrypted in Chromium, Firefox and WebKit and the native peer decoded the browser's audio and video; with a
wrong key no frame was verified and LiveKit reported `InvalidKey`.

**Stability.** After the last code change the call browser tests ran about 90 more times (`--repeat-each` in all four
projects, and Firefox alone): one failure, in Firefox, where an incoming video call's badge stayed at "Verifying
encryption…" for the test's 30 s instead of reaching "End-to-end encrypted". It did not recur in 20 further Firefox
runs and its cause is not known. It failed in the safe direction (the badge never claimed encryption it couldn't
prove); a failing call test now attaches the badge's per-track evidence (development builds only) to find it next time.

`e2e/calls.spec.ts` needs `livekit-server` (`brew install livekit`) and the dependencies of the Orbit
repository's `tools/griip-bot` (`npm ci` there, next to the server folder the tests use); without them it is skipped and says why. Playwright starts LiveKit for the run
(`scripts/livekit-dev.sh`, its own ports and a test key).

## 7. Known limits

- **Not tested with the Android app on a physical phone** (§8). The native peer in the browser tests uses LiveKit's
  native frame cryptor with the Android key handling, which makes interop likely, not proven.
- **Group calls** work like Android's (same server rules), but were tested here only one-to-one.
- **No screen sharing, no device picker** (the browser's default microphone and camera), no picture-in-picture
  window, no call history list (call entries appear in conversations). No ringing when no Orbit tab is open (no Web Push).
- **Keys aren't rotated** when people join or leave (T5.4, as on Android).
- **Browser trust:** script injected into the page could read call keys from memory while a call runs (like message
  keys; `ORBIT_WEB_STATUS.md` › Security). The deployment's CSP is the defence.
- **Firefox and WebKit** network-drop recovery is exercised only by the integration tests: Playwright's offline mode
  doesn't cut live connections in those engines.
- **One unexplained intermittent** in the browser tests (Firefox, badge stuck at "Verifying encryption…", §6).
- **CI doesn't run the call browser tests yet:** the GitHub Actions `web` job has no LiveKit server or native SDK, so
  `e2e/calls.spec.ts` skips there (the integration tests run). They run locally as described in §6.
- **Deployment:** production needs the CSP and `Permissions-Policy` changes in `ORBIT_WEB_DEPLOYMENT.md` (not applied).

## 8. Physical-phone test (to run together)

Everything runs on the Mac against a local Orbit server (`scripts/local-server.sh`), from this repository's folder; production isn't touched. You need the Mac and the phone
on the same Wi-Fi, and an Orbit **debug or testing** build on the phone (those accept `http://` and `ws://` servers).

1. Find the Mac's address on the Wi-Fi:
   ```bash
   ipconfig getifaddr en0
   ```
   Below it's written `MAC_IP` (it was `192.168.0.5` during development).
2. Start the media server (keep it running; allow `livekit-server` incoming connections if macOS asks):
   ```bash
   LIVEKIT_NODE_IP=MAC_IP bash scripts/livekit-dev.sh
   ```
3. In a second terminal, start the Orbit server with calling (allow `node` incoming connections if asked):
   ```bash
   LIVEKIT_PUBLIC_URL=ws://MAC_IP:7880 bash scripts/local-server.sh --calls
   ```
4. In a third terminal, start the web app:
   ```bash
   npm run dev
   ```
5. On the phone: **Settings › Server and about › Servers › Add a server**, `http://MAC_IP:8080`, **Check** (expect server
   0.3.0 and calling available), **Add and switch**, and create an account there. Your production account stays as it is.
6. Give the browser **its own account** (you can't call your own devices). The test tool makes one, "Alice", and acts
   as Alice's phone to link the browser:
   ```bash
   npx tsx scripts/demo-phone.ts setup
   ```
   Open `http://localhost:5173` on the Mac; it shows a link code. Approve it as Alice:
   ```bash
   npx tsx scripts/demo-phone.ts approve CODE
   ```
   Then open a conversation between Alice and your phone's account:
   ```bash
   npx tsx scripts/demo-phone.ts dm alice YOUR_PHONE_USERNAME
   ```
7. **Phone → browser, video.** On the phone, open the DM and start a video call. Check in the browser: the ring card
   appears and rings; the phone shows "Ringing…". Answer with video. Check on **both** sides: you see and hear each
   other; the badge reaches "End-to-end encrypted" (browser) and the phone's E2EE pill; tap/click both badges and
   compare the emoji and digits: **they must be identical**.
8. **Browser → phone, voice.** In the browser, start a voice call. The phone rings; answer. Check audio both ways, the
   badges and codes as above. Mute in the browser: the phone shows you muted; unmute.
9. **Camera on and off** in a video call from the browser: the phone's tile follows.
10. **Decline and busy.** Call the browser from the phone and decline in the browser: the phone shows "Declined". Then,
   while in a call with the browser, have someone else call the browser (or skip).
11. **Network drop.** During a call, turn the Mac's Wi-Fi off for about 10 s, then on: the browser shows
    "Reconnecting…" and the call comes back (same verification code). Repeat on the phone (airplane mode for 10 s).
12. **Hang up** from each side in turn; the other side ends at once.
13. **Refused microphone.** In the browser's site settings for `localhost:5173`, block the microphone, then answer a call
    from the phone: the browser explains and joins listen-only; the phone hears nothing from the browser but the badge
    still works. Re-allow afterwards.
14. **Both of your devices ring (optional).** Link a second browser profile to *your phone's* account (Settings ›
    Devices › Approve new device on the phone), then have the test bot call that account:
    ```bash
    cd ../griip-mesage/tools/griip-bot && GRIIP_SERVER=http://127.0.0.1:8080 GRIIP_BOT_ID=local-bot.json npm run bot -- call YOUR_PHONE_USERNAME video 60
    ```
    The phone and that browser both ring. Answer on the phone: the browser stops ringing. Next time answer in the
    browser: the bot's moving test pattern and tone arrive, and the phone stops ringing.

Record per step: pass or fail, what each badge said, whether the codes matched, and anything odd (echo, delay, video
orientation). Browser calls are called supported only after steps 7–12 pass.
