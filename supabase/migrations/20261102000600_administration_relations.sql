-- Additive release relations from dfb010738b323c37f7489cea8ef8491e88f03909; prior migrations remain immutable.
CREATE TABLE meldiq."billing_promotion_redemptions" (
  "code" text NOT NULL,
  "account_id" text NOT NULL,
  "user_id" text NOT NULL,
  "grant_id" text NOT NULL,
  "redeemed_at" bigint NOT NULL,
  "state" text NOT NULL DEFAULT 'redeemed',
  PRIMARY KEY ("code", "account_id")
);
ALTER TABLE meldiq."billing_promotion_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_redemptions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_promotion_redemptions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_promotion_redemptions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_promotion_redemptions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_promotions" (
  "code" text NOT NULL,
  "title" text NOT NULL,
  "product" text NOT NULL DEFAULT 'plus_time',
  "discount_percent" bigint NOT NULL DEFAULT 0,
  "months" bigint NOT NULL,
  "max_redemptions" bigint NOT NULL,
  "redeemed" bigint NOT NULL DEFAULT 0,
  "enabled" bigint NOT NULL DEFAULT 1,
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "version" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("code")
);
ALTER TABLE meldiq."billing_promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_promotions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_promotions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_promotions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."collectible_orders" (
  "id" text NOT NULL,
  "account_id" text,
  "user_id" text,
  "item_id" text NOT NULL,
  "item_version" bigint NOT NULL,
  "amount_minor" bigint NOT NULL,
  "original_amount_minor" bigint NOT NULL,
  "promotion_code" text,
  "currency" text NOT NULL,
  "provider" text NOT NULL,
  "session_ref" text,
  "checkout_url" text,
  "payment_ref" text,
  "status" text NOT NULL DEFAULT 'pending',
  "sync_status" text NOT NULL DEFAULT 'pending',
  "request_key" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collectible_orders_idx_collectible_orders_payment" ON meldiq."collectible_orders" ("provider", "payment_ref") WHERE "payment_ref" IS NOT NULL;
CREATE INDEX "collectible_orders_idx_collectible_orders_history" ON meldiq."collectible_orders" ("created_at", "id");
CREATE INDEX "collectible_orders_idx_collectible_orders_sync" ON meldiq."collectible_orders" ("sync_status", "updated_at");
CREATE UNIQUE INDEX "collectible_orders_sqlite_autoindex_collectible_orders_2" ON meldiq."collectible_orders" ("account_id", "request_key") WHERE "account_id" IS NOT NULL;
ALTER TABLE meldiq."collectible_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."collectible_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."collectible_orders" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."collectible_orders" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."collectible_orders" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_appeal_challenges" (
  "id" text NOT NULL,
  "account_id" text,
  "user_id" text,
  "code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_appeal_challenges_idx_platform_appeal_cha_de4584dd122d" ON meldiq."platform_appeal_challenges" ("expires_at");
ALTER TABLE meldiq."platform_appeal_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_appeal_challenges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_appeal_challenges" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_appeal_challenges" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_appeal_challenges" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_appeals" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "notice_id" text,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "decision" text,
  "assigned_to" text,
  "notified_version" bigint NOT NULL DEFAULT 0,
  "notification_error" text,
  "delivery_pending" bigint NOT NULL DEFAULT 0,
  "next_delivery_at" bigint NOT NULL DEFAULT 0,
  "sync_status" text NOT NULL DEFAULT 'complete',
  "version" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_appeals_idx_platform_appeals_delivery" ON meldiq."platform_appeals" ("delivery_pending", "next_delivery_at", "updated_at");
CREATE INDEX "platform_appeals_idx_platform_appeals_user" ON meldiq."platform_appeals" ("user_id", "created_at", "id");
CREATE INDEX "platform_appeals_idx_platform_appeals_status" ON meldiq."platform_appeals" ("status", "created_at", "id");
ALTER TABLE meldiq."platform_appeals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_appeals" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_appeals" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_appeals" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_appeals" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_notice_receipts" (
  "notice_id" text NOT NULL,
  "user_id" text NOT NULL,
  "read_at" bigint NOT NULL,
  PRIMARY KEY ("notice_id", "user_id")
);
ALTER TABLE meldiq."platform_notice_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_notice_receipts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_notice_receipts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_notice_receipts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_notice_receipts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_notices" (
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "target_user_id" text,
  "status" text NOT NULL DEFAULT 'draft',
  "starts_at" bigint NOT NULL,
  "ends_at" bigint,
  "version" bigint NOT NULL DEFAULT 1,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_notices_idx_platform_notices_target" ON meldiq."platform_notices" ("target_user_id", "created_at", "id");
CREATE INDEX "platform_notices_idx_platform_notices_live" ON meldiq."platform_notices" ("status", "starts_at", "id");
ALTER TABLE meldiq."platform_notices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_notices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_notices" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_notices" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_notices" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_ownership_requests" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "target_user_id" text NOT NULL,
  "requested_by" text NOT NULL,
  "approved_name" text,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "completed_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_ownership_requests_idx_platform_ownership_requests_org" ON meldiq."platform_ownership_requests" ("org_id", "status");
ALTER TABLE meldiq."platform_ownership_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_ownership_requests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_ownership_requests" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_ownership_requests" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_ownership_requests" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
