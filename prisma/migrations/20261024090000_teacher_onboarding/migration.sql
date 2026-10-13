-- Teacher applications as verification requests with a purpose (ADR-0073).

-- CreateEnum
CREATE TYPE "users"."VerificationPurpose" AS ENUM ('ACCOUNT', 'TEACHER_ROLE');

-- AlterTable
ALTER TABLE "users"."VerificationRequest" ADD COLUMN     "institution" TEXT,
ADD COLUMN     "purpose" "users"."VerificationPurpose" NOT NULL DEFAULT 'ACCOUNT',
ADD COLUMN     "subjects" TEXT;

-- One pending request per person and purpose: someone waiting to have their account verified can still ask to teach
-- (and an approved teacher application verifies the account too).
DROP INDEX "users"."VerificationRequest_pending_user_key";
CREATE UNIQUE INDEX "VerificationRequest_pending_user_key" ON "users"."VerificationRequest" ("userId", "purpose") WHERE "status" = 'PENDING';
