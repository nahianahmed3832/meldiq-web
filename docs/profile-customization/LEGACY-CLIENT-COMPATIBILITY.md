# Client reader compatibility

The richer profile is accepted by the supported client readers examined here. This is separate from the older API write-loss assessment in ROLLBACK-COMPATIBILITY.md.

## Deployed web reader

The profile schema and its enum helper are frozen from web `426ad2b03a2afcdbd8ac549ef4f0711e16c6ccac` under `test/support/legacy-web-426`. Their source hashes are recorded in `source.json`. The profile-schema SHA-256 also matches `/private/tmp/meldiq-social-production-20261102/web/src/api/profileSchemas.ts`, the actual deployed social-auth source.

That reader uses Zod's ordinary object decoder, which ignores additional fields. The regression feeds it the new API's captured `PATCH_v2_users_me_profile-customization` response containing a server-generated collectible descriptor. It preserves the frame, accent and name font, returns a non-null legacy style and omits unsupported metadata. All 854 web cases completed: 853 passed, one skipped, zero failed.

## Historical Android reader

`LegacyCollectibleCompatibilityTest.kt` freezes the seven fields of `ProfileStyleDto` from `c111376cab3d732f59b0ed17ecd16b03b309beee`. The historical and current `GriipJson` configuration blocks match byte-for-byte: `ignoreUnknownKeys=true`, with existing null/default handling. Its SHA-256 and source reference are in `verification/android-legacy-json-config.json`.

The historical DTO decodes the actual new profile fixture and retains the legacy frame, accent and font. The complete release JVM suite passed 988 cases with ten skips and zero failures/errors (998 total). Production APK/AAB source and bytes were unchanged by this test-only addition. Installed Play binaries were not inspected; physical-device rendering and performance are not claimed.

## Server schema and recovery scope

The prior server's strict response schema rejects a richer object when directly supplied to that schema. Its normal profile route builders first produce their explicit legacy response shape; the response schema is a different component from the web/Android readers verified above. This source distinction does not make the prior API safe for normal rollback writes: its legacy style editor and decoration takedown can discard stored collectible descriptors. Keep any such API fallback behind maintenance until a compatible fix is ready.

The new API retains legacy frame/effect/color fields alongside optional descriptors. Existing client edits use the updated server's overlap rules, and the canonical profile record remains the source of truth. No client-local ownership or compatibility workaround rewrites inventory.
