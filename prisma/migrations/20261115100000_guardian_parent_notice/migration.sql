-- Parent address, confirm and manage links, and Firebase installation ids (ADR-0110).
-- method becomes text so a later verification method needs no migration.
-- GuardianConsent is not dropped. parentEmail is cleared on purge.

ALTER TABLE "users"."GuardianConsent" ALTER COLUMN "method" SET DATA TYPE TEXT USING "method"::text;

DROP TYPE "users"."GuardianConsentMethod";

ALTER TABLE "users"."GuardianConsent" ADD COLUMN "verifiedAt" TIMESTAMPTZ(3),
ADD COLUMN "parentEmail" CITEXT;

CREATE TYPE "users"."GuardianLinkPurpose" AS ENUM ('CONFIRM', 'MANAGE', 'SESSION');

CREATE TABLE "users"."GuardianLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "users"."GuardianLinkPurpose" NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianLink_tokenHash_key" ON "users"."GuardianLink"("tokenHash");

CREATE INDEX "GuardianLink_userId_purpose_idx" ON "users"."GuardianLink"("userId", "purpose");

ALTER TABLE "users"."GuardianLink" ADD CONSTRAINT "GuardianLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "users"."FirebaseInstallation" (
    "fid" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirebaseInstallation_pkey" PRIMARY KEY ("fid")
);

CREATE INDEX "FirebaseInstallation_userId_idx" ON "users"."FirebaseInstallation"("userId");

ALTER TABLE "users"."FirebaseInstallation" ADD CONSTRAINT "FirebaseInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
