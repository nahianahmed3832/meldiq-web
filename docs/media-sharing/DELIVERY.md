# Meldiq media sharing implementation and release report

This change improves the existing photo, video and file-sharing module across Web, Android and the Atlas-compatible backend. It preserves S3, attachment IDs, original-file downloads, legacy encryption formats, Free/Plus entitlements and existing published media. The implementation and executed checks are recorded below. **The entire requested production objective is not certified complete:** physical-device checks, live staging S3 validation and the remaining features in section 16 are still outstanding. Nothing was deployed to production.

The backend work is isolated at `/Volumes/code_files/meldiq_media_module`, branch `codex/media-sharing-20261102`, based on release commit `f77d0790`. The older server under the Android checkout lacks the current release's entitlement and Atlas changes and was not used as the implementation baseline. Web and Android had substantial existing changes; these were preserved.

## 1 Initial audit findings

The code already provided encrypted file bodies, private S3 storage, size/checksum-bound presigning, multipart uploads, completion checks, quotas, retention jobs, authorized expiring downloads, captions, albums, gallery views and native media pickers. Web already had encrypted transfer checkpoints in IndexedDB and a sealed local wrapping key. Android streamed URI copies and encryption through app-private files and had Media3 playback and optional on-device compression.

The main defects were discarded multipart progress after network errors, upload cancellation that could still publish a small-file message, incomplete completion recovery after S3 assembly, missing posting/entitlement rechecks, automatic original-image replacement, automatic WebP download conversion, missing composer previews, weak download-range validation and unbounded aggregate plaintext caching. Completed but unsent uploads could be retained forever. Android recreated ciphertext on batch retries and lacked durable upload-session checkpoints.

**Security model:** file bodies reach S3 encrypted. The current `/v2/messages` mode sends attachment keys in server-readable message payloads. It is not end-to-end encrypted against the relay. The historical encrypted-envelope mode has different key protection. Neither server-side malware scanning nor an E2EE guarantee has been added or claimed.

## 2 Existing functionality retained

Legacy single-file AES-GCM and chunked formats, random attachment IDs, server-enforced Free/Plus and community Spark limits, captioned multi-file messages, voice messages, albums, original downloads, local caches, the outbox, encrypted-history keep requests, existing retention of published media, native Photo Picker/camera/file intents, Media3 controls and existing opt-in compression remain in place. Legacy Go records remain readable; no Go offer, pricing change or 2 GB limit was introduced. The absolute limit for new original files is now exactly **1,000,000,000 bytes (1 GB)**, with encryption overhead permitted separately. The earlier 1,024 MB/server and 1 GiB/client ceilings were inconsistent. Free remains subject to its configured lower entitlement (50 MB in the release defaults); effective Plus/Spark limits and persisted admin overrides are capped at 1 GB without changing pricing. Previously published larger attachments remain readable/downloadable under the legacy reader ceiling.

## 3 Bugs fixed

- Network errors retain multipart sessions and completed parts. Repeated authorization failures are cleaned up after bounded retries. Small-file CORS fallback remains available without discarding multipart progress.
- Concurrent part workers settle and stop after a sibling fails. Retry delays and uploads respect cancellation; already-aborted requests never start.
- Completion manifests are persisted before finalization. Retries can recover an object assembled by S3 before its metadata write completed.
- Small files use the same durable transfer path, cancellation checks and progress reporting. A saved message ID makes outbox retries idempotent.
- Persisted checkpoints serialize writes, and wrapping-key initialization is shared within a transfer manager.
- Original downloads return verified bytes with a sanitized original filename. WebP is no longer silently converted to JPEG/PNG.
- Download ranges, announced lengths and streamed byte bounds are checked before appending data. Plaintext caching is bounded in aggregate and scoped to an engine/account.
- Existing subscription-card code with an unreachable Free branch was simplified after type checking identified it.

## 4 New functionality

The Web composer has photo/video previews, dedicated photo and video pickers, photo/video camera capture inputs, explicit Original versus Optimized photo sharing, per-file status, aggregate progress and measured speed/remaining time when enough data is available. The viewer adds desktop zoom, pointer pinch/pan, sharing through the Web Share API where supported, codec-error feedback and a Safari fullscreen fallback. File cards have type, filename, size, progress, cancellation and retry.

Original media can carry a separate, bounded encrypted thumbnail. Both clients understand that descriptor; both generate optional thumbnails locally. Thumbnails use the existing upload/storage/access paths, not a separate media service. Both media browsers add photo/video filtering and filename search within their bounded collection pages. Native gallery tiles fetch optional small previews without loading full originals.

## 5 Backend changes

Upload renewal, part listing/signing and completion recheck membership, posting rights, attachment permission and current effective entitlements. A lowered size cap refuses continuation while preserving the owner's ability to cancel. S3 finalization checks sizes and part hashes/ETags; assembled-object recovery checks the multipart composite checksum. The recipient still verifies the whole ciphertext hash and GCM authentication.

New server-stored messages refuse missing, unfinished, foreign-conversation, duplicate, size-inconsistent or hash-inconsistent references. Unpublished references and downloads must belong to their uploader; other conversation members receive the same 404 as an unavailable file until publication. Preview MIME/size limits and key/nonce/hash encodings are validated. Published references record their first message ID. These checks do not decrypt or process media in the API request.

## 6 S3 and storage changes

No bucket, credential, IAM policy, CDN or production storage object was changed. Direct delivery is attempted first, with an authorized API proxy for CORS failures or hidden range headers; fallback preference is scoped to the affected engine. Existing private buckets, unpredictable keys and expiring signatures remain the foundation.

A read-only release check is supplied at `/Volumes/code_files/meldiq_web/scripts/media/check-storage.mjs`. It checks public-access blocks, encryption, origin/method/header CORS settings and an applicable multipart-abort lifecycle rule. The lifecycle fragment at `/Volumes/code_files/meldiq_web/deploy/media-sharing/s3-lifecycle.fragment.json` must be merged with existing rules and its prefix reviewed; it must not replace an existing bucket lifecycle configuration blindly. AWS recommends abort rules for incomplete parts; those rules do not delete completed objects. [AWS lifecycle guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html).

## 7 Image processing

Original is now the Web default and the default for new Android preferences. Existing explicitly stored Android quality choices remain effective. Optimized Web sharing is an explicit choice. Alpha-capable formats retain transparency, and animation-capable formats are conservatively excluded from Android photo recompression. AVIF signatures no longer depend on a trusted picker MIME label. Unsupported decoders fall back to original-file sharing/downloads.

Optional thumbnails are separate objects, limited to 128 KiB, with independent encryption metadata. Original IDs and bytes remain distinct. No bulk rewrite or recompression of existing media occurs.

## 8 Video processing

Video previews and optional thumbnails are generated on clients. Native frame extraction uses scaled frames where the OS supports them. Web includes inline playback, existing viewer controls, seeking within the decrypted local video and useful codec errors. Existing optional Android H.264 compression remains on the device. No server transcoding, worker, adaptive-streaming service or claim of completed transcoding was introduced.

## 9 Android changes

Uploads use cancellable presigned HTTP requests and bounded cleanup on cancellation. Multipart layouts are validated and only checksum-matching parts are reused. Upload sessions and completion manifests survive uploader recreation in app-private storage. Pending ciphertext and its reference metadata survive batch retries/process interruption; successful sends remove the encrypted working copy. The Room schema is unchanged because the pending metadata is part of the existing attachment JSON.

The application container uses account-scoped checkpoint directories. Separate thumbnails are generated, read, downloaded for previews and removed with local message attachments. History retention includes thumbnails. Original files remain the targets for viewing, saving and sharing. The legacy ciphertext limit now accounts for the GCM tag. The full-screen viewer uses bounded drawable decoding on Android 9+ to retain GIF/WebP animation, with lifecycle, active-page and reduced-motion controls; older systems retain a still-image fallback. The implementation follows the platform [ImageDecoder contract](https://developer.android.com/reference/android/graphics/ImageDecoder).

## 10 Web changes

The existing composer, transfer manager, gallery and viewer were extended in place. File bodies remain Blob/slice based during large uploads. Upload work is bounded across messages, and part concurrency stays controlled. File-signature checks use bounded prefixes; active HTML/SVG remain downloads. Photos larger than the automatic-download threshold wait for a user action unless a small preview exists.

Next.js's development indicator is hidden only in browser-test environments because it covered the mobile attachment button. Compile/runtime errors remain visible. Production behavior is unchanged by this test setting.

## 11 Security improvements

Completion permissions and entitlements are rechecked; object size/hash metadata is checked against published references; preview descriptors cannot recurse or request oversized/active-content previews. Download filenames remove path/control/bidirectional-spoofing characters. Browser rendering uses an inert MIME allowlist. Session/checkpoint material and decrypted caches are scoped to the signed-in client; no AWS credentials are sent to clients.

Storage should continue to use TLS, least-privilege access, encryption at rest and public-access blocks. Operator review should include existing access logging, CloudTrail data events and request metrics, with their logging/request costs considered. No such infrastructure changes were made. [AWS security guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html).

## 12 Performance and operating cost

A preview adds at most one small object, its PUT/GET requests and up to 128 KiB storage per generated preview; it can avoid downloading a large original for a chat tile. Decoding and frame extraction run on clients. There is no new server CPU transcoding workload or external-service subscription. Retry resumes reuse ciphertext and matching parts rather than encrypting/uploading an entire large file again.

Production upload latency, CPU, storage growth, bandwidth and CDN hit ratios were not measured in this local run. Existing upload/download traffic accounting and logs remain available; no new production metrics dashboard was provisioned. No pricing estimate is presented without workload/region data.

## 13 Database migration and integrity

`092_attachment_publication.sql` adds nullable `pending_message_until`, `message_id` and `sha256` columns plus indexes. The generated schema and native MongoDB file store are updated; the Mongo schema version becomes **8**. Existing rows receive no pending-publication deadline, retaining their previous policy. New server-message uploads expire if never published; publication applies the configured retention. The legacy encrypted-relay mode retains its previous policy. Explicit history keep also retains previews.

No IDs, object keys, existing originals or binary media were migrated. The server database stores metadata only. Local client ciphertext checkpoints remain local caches. Both SQLite compatibility and all sixteen Atlas domains were exercised locally.

## 14 Tests and results

See `/Volumes/code_files/meldiq_web/docs/media-sharing/evidence/` for logs and Android XML results. The final verification receipt records the latest commands/results; intermediate failures were fixed and rerun where part of this module.

- Backend S3, authorization, multipart, publication, limits, retention, schema and native file-store suites: **79 passed** after the exact-ceiling/admin-boundary update. The combined run with Mojo reported **100 passed, 1 failed**; the remaining gift test expects HTTP 404 but receives 409 on a foreign redemption request. The gift route/service were unchanged by this work.
- Publication/direct-upload tests with all sixteen Mongo domains enabled: **16 passed**. A final **3-test** publication/download-privacy rerun passed on both SQLite and all sixteen Atlas domains after restricting unpublished downloads to the uploader.
- Focused Web unit/integration suites, including a real local 30 MB encrypted round trip and simulated multipart storage: **39 passed** in the recorded integration run. A subsequent **15-test** upload/download/transfer regression run passed, including account-scoped proxy coverage. These runs overlap and are not additive totals.
- Android focused suites: **56 passed, zero failures/errors/skips**, including collection-page and exact-ceiling coverage. `assembleDebug` and `assembleDebugAndroidTest` succeeded. The APK is at `/Volumes/code_files/meldiq_android/android/app/build/outputs/apk/debug/app-debug.apk`.
- Web and backend type checks and focused lint passed. The production Web build/export and service-worker bundle succeeded; the receipt records the final commands.
- The broad Web run reported **905 passed, 2 failed, 1 skipped**. A later four-suite limit/upload/download/transfer regression run passed **20 tests** after the exact 1 GB change. The failures are a Mojo catalog fixture mismatch and billing-promotion routes missing from the existing contract table. Those unrelated contract checks were not disabled or allowlisted.
- Browser scenarios: **8 passed** across Chromium, WebKit, Android-sized Chrome and iPhone-sized WebKit. They cover albums/documents, exact original downloads, zoom, video previews, inline playback and readable mobile filenames. These are browser-engine tests, not physical-phone certification.
- No physical Android device was attached. An isolated API-36.1 emulator was created from an installed image with no existing emulator accounts/app data and with networking disabled. **All 3 native instrumentation checks passed**: real GIF/WebP animated decoding with bounded frames and start/stop, damaged-media handling, and the actual viewer opening/zoom/save/share-action path. The save/share callback was tested without exporting to a gallery or sending anything. The QA emulator was closed afterward; physical devices and actual OS share/save flows remain uncertified. No live AWS upload, production conversation or production test data was used.

## 15 Deployment requirements

1. Review/forward-port the backend patch from base `f77d0790` onto the current release branch; keep newer payment/profile/database work. Do not deploy the older Android-root server as a replacement.
2. Back up database metadata and rehearse the additive migration/schema-8 bootstrap on staging, retaining all sixteen domain authorities and the current compatible CLI. Deploy the backend before clients.
3. Run the read-only S3 check with `MELDIQ_SERVER_DIR`, `S3_BUCKET`, `S3_REGION` and `MELDIQ_MEDIA_ORIGIN`. Review the configured prefix, private access, signed request permissions and CORS. API proxy fallback does not replace a correct bucket configuration.
4. Review the lifecycle fragment, merge only an appropriate missing rule, and verify cleanup jobs, pending-publication expiry, download authorization and range behavior on staging. No infrastructure mutation is authorized by this report itself.
5. Build the Web export and Android release candidate, run the remaining physical-device/staging cases below, then use the normal coordinated release/health-check process. Check API health, schema version, upload/completion/error logs and existing traffic metrics after rollout.

## 16 Remaining limitations and incomplete requirements

- **Production readiness:** live staging S3/CORS/lifecycle checks, near-ceiling end-to-end transfers, concurrent-user/load measurements and deployment health/rollback rehearsal remain. Staging credentials/targets and physical devices were not supplied; none were inferred from production configuration. The 1 GB boundary tests validate authorization/layout, not a full 1 GB browser transfer.
- **E2EE against the relay:** the current server-message mode exposes reference keys to the relay. True E2EE would require carrying those keys only in an authenticated encrypted conversation envelope/wrap, consistently on both clients; the existing attachment wire formats can remain. This change does not make that architectural/security change.
- **Plaintext inspection/malware scanning:** signature checks run on devices. S3/body validation covers ciphertext sizes/checksums and publication metadata. No existing malware scanner was found/integrated, and ciphertext is not claimed to be scanned. A future design must explicitly reconcile scanning with the chosen message-encryption threat model.
- **Adaptive/early video playback and codec metadata:** Web playback begins after the original is downloaded/decrypted. Network-seek streaming of encrypted originals, HLS/DASH variants and uniform codec-ID extraction are not implemented. Only the synthetic H.264 MP4 playback path was exercised; MOV/HEVC/other combinations depend on the actual device decoder and need a compatibility matrix. No expensive server infrastructure was introduced to conceal this gap.
- **Gallery parity:** the current Android checkout contains a concurrent paginated collection browser for media/files/pins/threads, with cached-message fallback for servers without the capability. That implementation was preserved rather than duplicated. Native photo/video and filename filters now apply to the visible page, with small thumbnails fetched for visible older items. Native collection behavior has JVM coverage; full UI browsing of thousands of items has not been certified. Web uses bounded server collection pages with added photo/video and filename filters.
- **Animated native viewing:** the viewer now uses bounded platform drawable decoding for GIF/WebP on Android 9+, retaining zoom/pan and pausing inactive/backgrounded animations. Older Android versions use a still-image fallback; animated AVIF and decoder-specific combinations are not certified.
- **Document previews:** safe file cards/downloads are available. An isolated PDF/document previewer is not added; untrusted HTML/SVG are never shown as application pages.
- **Background execution and OS integrations:** checkpoints support explicit retry/resume after interruption. Automatic OS-scheduled background completion is not added: it needs foreground/WorkManager scheduling coordinated with authenticated sessions and the persistent queue. Real camera/gallery permission flows, Android save/share sheets, Web Share sheets and Safari/iPhone behavior still need physical-device validation. The isolated emulator decoder/viewer checks do not certify those OS flows.
- **Observability:** production success-rate/processing-latency dashboards, alerts and a measured operating-cost baseline remain operational work. Existing traffic accounting/logs are retained, and the new preview path does not claim a background processing job or transcode completion.
- **Repository-wide contract drift:** the two unrelated billing contract failures above remain unresolved in this checkout. They must be reconciled with the owning billing release before claiming an entirely green repository suite.

## 17 Rollback

Rollback clients independently if needed: old readers ignore new optional thumbnail/dimension fields and continue opening the original descriptor. Keep the schema-8-capable backend/CLI while investigating a client issue. Stop new uploads first if a server rollback is necessary; retain backups and every S3 object. Use a compatible forward fix or a rehearsed compatible backend rollback, retaining the nullable columns and generated-schema authority. Do not drop fields, rewrite stored media, restore an obsolete database snapshot over live messages, or run a media deletion sweep as rollback.

The additive SQL migration is not reversed destructively. Existing published media keeps its prior retention. Pending new uploads expire through normal cleanup; incomplete S3 parts use the existing abort flow and an operator-reviewed lifecycle rule. Staging must verify rollback before production certification.

The complete edited-file list is `/Volumes/code_files/meldiq_web/docs/media-sharing/modified-files.json`. The reviewable backend patch is `/Volumes/code_files/meldiq_web/server-patches/0011-media-sharing.patch`.

Verification commands, individual results and logs: [verification receipt](/Volumes/code_files/meldiq_web/docs/media-sharing/verification.json). Visual evidence includes [iPhone-sized composer](/Volumes/code_files/meldiq_web/docs/media-sharing/evidence/iphone-media-composer.png) and [native viewer](/Volumes/code_files/meldiq_web/docs/media-sharing/evidence/android-native-viewer.png).

## Production integration requested November 2

The production candidate is forward-ported onto API `64fc3f4f` and Web `780aaa8`, preserving the current administration controls, public community icons, poll viewer, and deployed runtime validation safeguards. Migration 092 and Mongo schema 8 supersede the original unreleased media migration number. Candidate API commit: `b34d3ee82eeb82cdcce8d2e5af0ad06ead17398d`. Latest integrated tests pass: 113 API, 28 all-domain Atlas and 901 Web unit tests (one skipped). The production export is verified through normal email onboarding; final deployment evidence will be recorded separately. Historical earlier failures above are retained as observations of their earlier checkouts.


## Verified production release — November 2, 2026

Web is live at https://web.meldiq.app, with API 0.76.1 and Mongo schema 8 across all sixteen Atlas domains. The exact tested export was published at 14:16:57 UTC. Migration 092 adds nullable attachment publication metadata and indexes. Public HTML and service-worker hashes match the tested export; public server-info reports the exact 1,000,000,000-byte file ceiling. The server advertises a separate ciphertext transport ceiling to cover encryption overhead. Existing accounts, API environment, ports/mounts, Nginx and public config were preserved. The encrypted backup was verified before deployment. Aggregate receipt: `production-evidence/production-receipt.json`.

The user authorized a temporary dbAdmin@meldiq grant to perform collMod. It was removed after migration. Atlas shows only readWrite@meldiq, and a new database connection confirms canCollMod=false with schema 8. Cluster restriction and credentials were preserved. Permission evidence: `production-evidence/permissions-restored.json`. A read-only comparison checks all 244 collection validators against the release schema using only restored runtime permissions: zero mismatches, so startup requires no collMod.

Production integration passed 113 API tests, 28 Atlas tests, 901 Web unit tests (one skipped), eight browser tests against the exact production export, lint, format, typecheck, build and GitHub CI. Historical failures from the original worktrees above do not describe this integrated candidate. Source was pushed as MD.NAHIAN AHMED (GitHub nahianahmed3832), without an automated coauthor. Platform/UI implementation details and the explicitly listed physical-device, near-ceiling/load, streaming/document-preview and encryption-threat-model limitations remain as documented above. Successful deployment does not certify those incomplete capabilities.

The committed Android integration preserves current committed native work and contains the media changes only. Its gallery filters operate on the existing cached-message window; the separate uncommitted paginated collection work in the shared Android checkout was not included. Android Play Store publication is a separate signed release step.

Android source commit `5d9621f6214ed3af5dfe539f69862b05c7bc8280` is pushed to `nahianahmed3832/meldiq` on `internal-beta` and `codex/android-media-sharing-20261102`. All 58 focused checks and both APK assemblies pass. Full native JVM run: 783/787 passed, with four existing realtime-contract failures recorded in the native evidence. The codec and contract test sources are unchanged from the integration base. No signed Play Store release was made. Native verification: https://github.com/nahianahmed3832/meldiq/blob/5d9621f6214ed3af5dfe539f69862b05c7bc8280/docs/media-sharing/ANDROID.md
