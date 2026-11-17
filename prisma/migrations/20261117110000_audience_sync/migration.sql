-- Product email: when the account was last written to the Resend audience, and the local opt-out.
-- Additive. Existing accounts stay unsynced (null) until the backfill. productEmails defaults to on.

ALTER TABLE "users"."User" ADD COLUMN IF NOT EXISTS "audienceSyncedAt" TIMESTAMPTZ(3);

ALTER TABLE "comms"."NotificationSettings" ADD COLUMN IF NOT EXISTS "productEmails" BOOLEAN NOT NULL DEFAULT true;
