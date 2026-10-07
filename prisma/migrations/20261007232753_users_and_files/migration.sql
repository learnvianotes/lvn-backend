-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notes";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "users";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "users"."GlobalRole" AS ENUM ('STUDENT', 'TEACHER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "users"."OAuthProvider" AS ENUM ('GOOGLE', 'GITHUB', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "users"."VerificationMethod" AS ENUM ('INSTITUTIONAL_EMAIL', 'TEACHER', 'DOCUMENTS');

-- CreateEnum
CREATE TYPE "users"."VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "users"."EmailTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "users"."ConsentKind" AS ENUM ('TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "users"."OrgRole" AS ENUM ('ORG_ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "users"."DomainReviewStatus" AS ENUM ('ACADEMIC_QUEUED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "users"."YearOfStudy" AS ENUM ('YEAR_1', 'YEAR_2', 'YEAR_3', 'YEAR_4', 'YEAR_5', 'POSTGRADUATE', 'GRADUATED', 'SCHOOL', 'NOT_STUDYING');

-- CreateEnum
CREATE TYPE "users"."LimitKey" AS ENUM ('STORAGE_BYTES', 'AI_TOKENS_DAILY', 'PDF_PAGES_MONTHLY', 'GROUPS_OWNED', 'GROUP_MEMBERS', 'CLASSROOMS_OWNED', 'CLASSROOM_MEMBERS', 'PROJECT_WORKSPACES', 'EXPORTS_DAILY', 'IMPORTS_DAILY', 'ORG_SEATS');

-- CreateEnum
CREATE TYPE "users"."LegacyImportStatus" AS ENUM ('NOT_FOUND', 'AVAILABLE', 'CLAIMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "notes"."FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'QUARANTINED', 'DELETED');

-- CreateEnum
CREATE TYPE "notes"."FileParentType" AS ENUM ('NOTE', 'CARD', 'GROUP_POST', 'RESOURCE', 'AVATAR', 'VERIFICATION_REQUEST');

-- CreateEnum
CREATE TYPE "notes"."FilePurpose" AS ENUM ('ATTACHMENT', 'COVER', 'VOICE_NOTE', 'AVATAR', 'IMPORT', 'EXPORT', 'VERIFICATION_DOCUMENT');

-- CreateEnum
CREATE TYPE "notes"."ScanResult" AS ENUM ('CLEAN', 'INFECTED', 'ERROR');

-- CreateTable
CREATE TABLE "users"."User" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "dateOfBirth" DATE,
    "registrationCompletedAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "verificationMethod" "users"."VerificationMethod",
    "globalRole" "users"."GlobalRole" NOT NULL DEFAULT 'STUDENT',
    "avatarFileId" UUID,
    "deletionRequestedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "refreshTokenHash" BYTEA NOT NULL,
    "device" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."OAuthAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "users"."OAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."EmailToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "users"."EmailTokenPurpose" NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."InstitutionalEmail" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "organizationId" UUID,
    "codeHash" BYTEA,
    "codeExpiresAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMPTZ(3),
    "replacedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionalEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "emailDomains" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."DomainReview" (
    "domain" TEXT NOT NULL,
    "status" "users"."DomainReviewStatus" NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),
    "decidedBy" UUID,

    CONSTRAINT "DomainReview_pkey" PRIMARY KEY ("domain")
);

-- CreateTable
CREATE TABLE "users"."Membership" (
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "users"."OrgRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "users"."ConsentRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "users"."ConsentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."VerificationRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "method" "users"."VerificationMethod" NOT NULL,
    "teacherId" UUID,
    "status" "users"."VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "documentIds" UUID[],
    "decidedBy" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."StudentProfile" (
    "userId" UUID NOT NULL,
    "department" TEXT,
    "departmentKey" TEXT,
    "yearOfStudy" "users"."YearOfStudy",
    "interestTopicIds" UUID[],
    "showOnProfile" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "users"."Plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."Entitlement" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "key" "users"."LimitKey" NOT NULL,
    "limit" BIGINT,
    "appliesToRole" "users"."GlobalRole",

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."UserPlan" (
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPlan_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "users"."LegacyImport" (
    "userId" UUID NOT NULL,
    "legacyUid" TEXT,
    "status" "users"."LegacyImportStatus" NOT NULL,
    "counts" JSONB,
    "snapshotKey" TEXT,
    "matchedBy" TEXT,
    "claimedAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegacyImport_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "users"."AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."FileObject" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "parentType" "notes"."FileParentType" NOT NULL,
    "parentId" UUID,
    "purpose" "notes"."FilePurpose" NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "variants" JSONB,
    "mimeType" TEXT NOT NULL,
    "detectedMimeType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "pageCount" INTEGER,
    "originalFileName" TEXT NOT NULL,
    "status" "notes"."FileStatus" NOT NULL DEFAULT 'PENDING',
    "scanResult" "notes"."ScanResult",
    "scannedAt" TIMESTAMPTZ(3),
    "visibilitySnapshot" TEXT,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FileObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "users"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "users"."User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "users"."Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "users"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "users"."Session"("familyId");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "users"."OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "users"."OAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "users"."EmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailToken_userId_purpose_idx" ON "users"."EmailToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "InstitutionalEmail_userId_idx" ON "users"."InstitutionalEmail"("userId");

-- CreateIndex
CREATE INDEX "InstitutionalEmail_email_idx" ON "users"."InstitutionalEmail"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "users"."Membership"("organizationId");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_kind_idx" ON "users"."ConsentRecord"("userId", "kind");

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_createdAt_idx" ON "users"."VerificationRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationRequest_teacherId_status_idx" ON "users"."VerificationRequest"("teacherId", "status");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "users"."VerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentProfile_departmentKey_yearOfStudy_idx" ON "users"."StudentProfile"("departmentKey", "yearOfStudy");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "users"."Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_planId_key_appliesToRole_key" ON "users"."Entitlement"("planId", "key", "appliesToRole");

-- CreateIndex
CREATE INDEX "UserPlan_planId_idx" ON "users"."UserPlan"("planId");

-- CreateIndex
CREATE INDEX "LegacyImport_legacyUid_idx" ON "users"."LegacyImport"("legacyUid");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "users"."AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "users"."AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileObject_storageKey_key" ON "notes"."FileObject"("storageKey");

-- CreateIndex
CREATE INDEX "FileObject_ownerId_status_idx" ON "notes"."FileObject"("ownerId", "status");

-- CreateIndex
CREATE INDEX "FileObject_parentType_parentId_idx" ON "notes"."FileObject"("parentType", "parentId");

-- CreateIndex
CREATE INDEX "FileObject_status_expiresAt_idx" ON "notes"."FileObject"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "users"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."InstitutionalEmail" ADD CONSTRAINT "InstitutionalEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."InstitutionalEmail" ADD CONSTRAINT "InstitutionalEmail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "users"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "users"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Entitlement" ADD CONSTRAINT "Entitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "users"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."UserPlan" ADD CONSTRAINT "UserPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."UserPlan" ADD CONSTRAINT "UserPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "users"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."LegacyImport" ADD CONSTRAINT "LegacyImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One confirmed institutional email verifies one account at a time (ADR-0017). Prisma cannot express a partial
-- unique index, so it is written here.
CREATE UNIQUE INDEX "InstitutionalEmail_confirmed_email_key"
  ON "users"."InstitutionalEmail" ("email")
  WHERE "verifiedAt" IS NOT NULL AND "replacedAt" IS NULL;

-- At most one unconfirmed address per user, so a new code always replaces the pending one.
CREATE UNIQUE INDEX "InstitutionalEmail_pending_user_key"
  ON "users"."InstitutionalEmail" ("userId")
  WHERE "verifiedAt" IS NULL AND "replacedAt" IS NULL;

-- One pending verification request at a time (ADR-0019).
CREATE UNIQUE INDEX "VerificationRequest_pending_user_key"
  ON "users"."VerificationRequest" ("userId")
  WHERE "status" = 'PENDING';
