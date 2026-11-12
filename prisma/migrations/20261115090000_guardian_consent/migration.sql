-- Guardian notice for a sign-up under 18 (ADR-0109).
-- No cascade: purging an account anonymises the user and deletes ConsentRecord, and leaves this row.
-- The row holds no name, email or date of birth.

CREATE TYPE "users"."GuardianConsentMethod" AS ENUM ('auto_unverified', 'verified');

CREATE TABLE "users"."GuardianConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "users"."ConsentKind" NOT NULL DEFAULT 'GUARDIAN',
    "method" "users"."GuardianConsentMethod" NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageBand" TEXT NOT NULL,

    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuardianConsent_method_noticeVersion_idx" ON "users"."GuardianConsent"("method", "noticeVersion");

CREATE INDEX "GuardianConsent_ageBand_idx" ON "users"."GuardianConsent"("ageBand");

CREATE INDEX "GuardianConsent_userId_idx" ON "users"."GuardianConsent"("userId");

ALTER TABLE "users"."GuardianConsent" ADD CONSTRAINT "GuardianConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
