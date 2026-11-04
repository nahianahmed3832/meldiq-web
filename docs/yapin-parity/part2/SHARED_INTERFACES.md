# Part 2 shared interfaces for Parts 3 and 4

The Web branch is `codex/meldiq-part2-foundation` in `/Volumes/code_files/meldiq_web_part2_foundation`; backend companion is `codex/meldiq-part2-profile-contract` in `/Volumes/code_files/meldiq_part2_api`. Preserve the dirty original checkout. See [baseline](baseline.json) and [Part 2 report](../handoffs/PART_2_REPORT.md). No production deployment or database migration was performed.

## C-AUTH and C-KEYS

Keep AccountApi, SetupCredentials, create/add-device contracts and the custom account/device session model. AuthScreen still hands `onSave(device, grant)` the created device before displaying recovery material and calls `onReady(device, grant)` only through the existing completion boundary. Signup → email verify → encryption identity → recovery acknowledgement → welcome is the new-account sequence. Login on a new browser restores existing keys and skips fresh-account welcome. Google/Discord remain their existing adapter, not a replacement authentication authority. Native Supabase Auth/Realtime migration is not enabled here.

`useSubmit.run` synchronously rejects duplicate in-flight calls. `PasswordInput` accepts ordinary input props, manages reveal state only, and never owns persistence. `useCodeCooldown` provides a presentation deadline; server rate limits remain authoritative. TermsConsent requires 13+ declaration and links current public policies. It is not age verification or a durable policy ledger. Follow [policy release contract](legal/RELEASE_NOTES.md) before claiming cross-client legal acceptance.

Welcome state is a presentation stage keyed by account ID in browser localStorage: 0 profile, 1 preferences, 2 destination, -1 done; missing means not enrolled. Unavailable storage uses an in-memory fallback. It stores no email, password, token, recovery material, private key, profile or avatar. Do not reuse it for authorization or server onboarding completion. `startWelcome` is called only after a newly created identity; `saveWelcomeStage` advances it. Returning accounts and account switching must keep their existing device stores and outboxes.

## C-SHELL and C-NAVIGATION

Keep `application/router.ts`, `ui/shell/navigation.tsx` and existing route/lastPlace behavior. Home, Messages, Friends, Communities, Discover, Activity, Saved/Reminders, account/Profile/Settings, notification and feature destinations use the existing router. Phone keeps its established primary tabs with You for account/settings; Discover remains reachable through existing discovery entry points. Do not add parallel route state or separate per-feature sidebars. Deep links remain permission/capability checked by their owning domain.

Register settings in `settingsCatalog.tsx` and `settingsInfo.ts`; personal groups and community settings remain separate scopes. SettingsNavigation consumes the filtered registry. Query search considers label, description and keywords; ArrowDown enters results, Up/Down/Home/End navigate them, Enter from search activates a unique result. Domain owners retain actual permission checks even when a destination is absent from navigation.

`Overlay.tsx` remains the Dialog/Popover/Menu/focus entry point. Top-modal isolation marks siblings inert, supports nested portals, and returns focus when closing. Avoid creating bespoke body-level focus traps or changing another feature's inert state. Use ConfirmationDialog and UnsavedChanges for destructive exits and dirty drafts. SkipToContent targets the visible settings/main/sidebar heading, never a hidden desktop panel. StatePanel accepts title, description, loading/error flags and optional action children; caller supplies actual retry/cancel actions.

## C-PROFILE

`ProfileContent` renders About, Links and Connections in the same order in preview and full profile. `profileSections.ts` defines the default order and bounded immutable movement. `ProfileDraftProvider` retains separate identity, style and layout drafts; a preview does not mutate the live account. ProfileSectionsCard uses the existing style revision/unsaved-change contract, explicit Save sections and Reset section changes, and appears only when `/v1/server-info.features` contains **`profile-layout`**.

The existing `PUT /v1/users/me/profile-style` optionally accepts:

```json
{"baseStyleRevision":"current revision", "layout":{"order":["connections","about","links"],"hidden":["about"]}}
```

Order must contain each of `about`, `links`, `connections` exactly once; hidden is a unique subset. `layout: null` resets. Omitting layout preserves it, so older native/style clients do not erase the choice. Malformed writes return 400; a stale revision returns 409 without replacing the newer style. Existing `users.profile_style` JSON stores it, so no SQL schema migration is needed. Unknown/malformed stored layout falls back safely without discarding valid styling. Ownership, free customization, profile revisions and existing endpoint/authentication remain unchanged.

The backend omits hidden About/Links/Connections from other viewers; owner editing retains its original data. Existing bio audience, blocked/relationship and connection visibility checks still apply. Hiding a section cannot expand an audience. Older clients also receive the withheld projection. Part 3 must keep these rules in every new profile/social projection; do not infer public connections from cached owner responses. New social/comment/activity sections require their own schema/authority/moderation design; they are not added by appending a UI-only key.

Release the backend capability before relying on the editor. Older production backend means the new editor stays hidden. Older Web/Android/Windows clients may ignore the optional layout but must continue to preserve it when saving unrelated style. Part 4 must verify this against installed native clients and the exact running API overlay, not just the local SQLite fixture.

## C-MEDIA, C-CALL, C-ENTITLEMENTS and C-RELEASE consumers

Use existing media/photo processing, style draft, icon/button/tooltip/menu and language/theme controls. Avatar setup uses the existing square-image upload. Banner/animation limits, call tracks, sound, push, file lifecycle, bots and billing remain owned by Parts 3/4 as assigned. No new dependency, paid customization gate, provider, account grant, card capability or infrastructure was introduced. Notifications/call preferences keep their common settings frame but their feature owners must accept actual behavior.

Final release requires immutable Web/API sources, the then-current predecessor, compatible installed native clients, current public policy and support pages, versioned policy acceptance, provider/device acceptance, and a rollback that preserves newly stored profile JSON and later customer data. Do not deploy the older dirty shared Web tree or overwrite the Frankfurt authority with an old backup.
