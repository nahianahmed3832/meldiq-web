# Poll results and media viewer release

Built from source commit `0216562` with the Webpack production build, without development device-linking or public source maps. Follow-up commit `a5cd6ea` corrects only a timed-poll browser fixture: direct API sends from the current device require a history refresh. Author and committer: MD.NAHIAN AHMED.

- Counts and percentages appear together; percentages use unique voters, including for multiple-answer polls.
- Named voter lists support answer filters; hidden-name ballots show Anonymous voter without resolving their identity or fetching their avatar.
- Vote visibility changes, retraction, scheduled closure and confirmed early closure sync through the existing vote protocol.
- Full images preserve their aspect ratio in a measured viewport. Fit width, actual size, zoom, panning, arrow-key/button navigation and a bounded thumbnail strip work across loaded conversation messages and media galleries.
- New very tall or wide screenshots keep their original resolution instead of being resized to a 2560px longest edge.

See [design, privacy scope and research](../../docs/design/POLLS_AND_MEDIA.md). Name hiding applies to results in updated web clients; existing attributable sender IDs remain in transport/storage. It is not cryptographic anonymity.

The release publisher checks both deployment locks, the predecessor, archive/file hashes and unchanged backend/configuration. It retains old hashed assets, switches atomically and rolls back on verification failure. Deployment status is recorded in a separate receipt only after a successful server publication.

Validation passed: CI type checking, lint, formatting, 891 unit tests (one skipped), Webpack production build, and four complete workflows against the exact CI artifact in Chromium and WebKit, including 390px phone layouts. Shared-workspace integration also passed type checking and focused lint while retaining existing download, thumbnail, video and media-filter work.

**Production publication is pending:** the known SSH endpoint times out before authentication. No production files or data were changed. The release manifest and guarded publisher are ready, with the expected predecessor rechecked by the publisher when connectivity is restored.
