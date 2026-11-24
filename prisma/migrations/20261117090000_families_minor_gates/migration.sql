-- Families gates for under-13 accounts (ADR-0112).

ALTER TABLE "users"."GuardianConsent" ADD COLUMN "socialEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"."User" ADD COLUMN "safetyReminderAcknowledgedAt" TIMESTAMPTZ(3);
