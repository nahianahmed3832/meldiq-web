-- The existing manifest revision also binds approval of a bot's public media encryption key.
-- No account devices, credentials or private key storage are added.
ALTER TABLE meldiq.bot_requested_permissions ADD COLUMN voice_public_key text;
ALTER TABLE meldiq.bot_requested_permissions ADD CONSTRAINT bot_voice_public_key_shape
  CHECK(voice_public_key IS NULL OR voice_public_key ~ '^[A-Za-z0-9+/]{43}=$');
