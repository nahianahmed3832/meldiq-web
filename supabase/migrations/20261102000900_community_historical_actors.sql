-- Community-owned records survive a former moderator/creator account being purged.
-- These fields are historical actor IDs, not ownership/deletion dependencies. Keep the exact IDs for audit.
-- Community, pin and award-recipient ownership FKs remain enforced; authenticated client CRUD remains denied.
ALTER TABLE meldiq.community_pins DROP CONSTRAINT native_community_pins_fk_1;
ALTER TABLE meldiq.community_pin_awards DROP CONSTRAINT native_community_pin_awards_fk_3;
ALTER TABLE meldiq.community_rules DROP CONSTRAINT native_community_rules_fk_0;
