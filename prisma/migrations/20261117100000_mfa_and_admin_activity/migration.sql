-- Second factors (email OTP now; TOTP and WebAuthn reserved) and the columns the admin activity log shows.
-- AuditLog stays append-only: the trigger rejects UPDATE and DELETE. TRUNCATE is unaffected.

ALTER TABLE "users"."User" ADD COLUMN "mfaOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users"."User" ADD COLUMN "mfaExemptUntil" TIMESTAMPTZ(3);

ALTER TABLE "users"."Session" ADD COLUMN "mfaVerifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "users"."Session" ADD COLUMN "amr" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "users"."AuditLog" ADD COLUMN "actorEmail" TEXT;
ALTER TABLE "users"."AuditLog" ADD COLUMN "ip" TEXT;
ALTER TABLE "users"."AuditLog" ADD COLUMN "userAgent" TEXT;

CREATE INDEX "AuditLog_createdAt_idx" ON "users"."AuditLog" ("createdAt" DESC);

CREATE TYPE "users"."MfaFactorType" AS ENUM ('EMAIL_OTP', 'TOTP', 'WEBAUTHN');
CREATE TYPE "users"."MfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

CREATE TABLE "users"."user_mfa_factors" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "users"."MfaFactorType" NOT NULL,
    "status" "users"."MfaFactorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),

    CONSTRAINT "user_mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_mfa_factors_userId_type_key" ON "users"."user_mfa_factors"("userId", "type");
CREATE INDEX "user_mfa_factors_userId_idx" ON "users"."user_mfa_factors"("userId");

ALTER TABLE "users"."user_mfa_factors" ADD CONSTRAINT "user_mfa_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "users"."mfa_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "factorType" "users"."MfaFactorType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMPTZ(3),
    "sessionFamilyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_challenges_userId_createdAt_idx" ON "users"."mfa_challenges"("userId", "createdAt");

ALTER TABLE "users"."mfa_challenges" ADD CONSTRAINT "mfa_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "users"."audit_log_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit log is append-only';
END;
$$;

CREATE TRIGGER "audit_log_no_update"
BEFORE UPDATE OR DELETE ON "users"."AuditLog"
FOR EACH ROW EXECUTE FUNCTION "users"."audit_log_append_only"();
