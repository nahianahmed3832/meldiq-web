# Rules channel — 2 November 2026

Rules is a distinct channel choice with a book icon. It creates a public text channel and registers it using the existing community rules API; only members with permission to edit the community can post. Announcement channels retain their own type and megaphone icon. Rules channels use the book icon in the sidebar, conversation header, channel browser, channel details and channel settings list.

Creation preserves saved rules and the agreement requirement, refuses to replace an existing rules channel, and retains the newly created channel when registration fails so a retry does not create a duplicate. A new channel is read-only while registration is pending. Server Settings → Rules also offers creation when no rules channel is configured.

The static deployment script takes the shared production and web release locks, verifies the expected current release and artifact hashes, preserves runtime configuration and old hashed assets, and switches the release symlink atomically. It verifies served asset hashes and deep links, with automatic code rollback on failure. Nginx and the API are checked for changes. Previous releases are retained.
