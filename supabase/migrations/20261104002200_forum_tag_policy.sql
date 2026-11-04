ALTER TABLE meldiq.conversations ADD COLUMN IF NOT EXISTS forum_require_tag bigint NOT NULL DEFAULT 0 CHECK(forum_require_tag IN (0,1));
