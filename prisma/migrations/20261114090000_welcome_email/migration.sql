-- One welcome email per account, claimed when the worker sends it.
-- Additive and safe to run again: one nullable column. Existing accounts stay null and are not emailed.

ALTER TABLE "users"."User" ADD COLUMN IF NOT EXISTS "welcomeEmailSentAt" TIMESTAMPTZ(3);
