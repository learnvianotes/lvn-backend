-- CreateEnum
CREATE TYPE "users"."TeacherSkillStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "users"."ExternalIdentityKind" AS ENUM ('GITHUB', 'WEBSITE', 'ORCID', 'OPENALEX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "users"."TeacherSkillKind" ADD VALUE 'PROJECT';
ALTER TYPE "users"."TeacherSkillKind" ADD VALUE 'PUBLICATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "users"."TeacherSkillSource" ADD VALUE 'GITHUB';
ALTER TYPE "users"."TeacherSkillSource" ADD VALUE 'WEBSITE';
ALTER TYPE "users"."TeacherSkillSource" ADD VALUE 'ORCID';
ALTER TYPE "users"."TeacherSkillSource" ADD VALUE 'OPENALEX';

-- AlterTable
ALTER TABLE "users"."TeacherSkill" ADD COLUMN     "fetchedAt" TIMESTAMPTZ(3),
ADD COLUMN     "identityId" UUID,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "status" "users"."TeacherSkillStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "users"."ExternalIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "users"."ExternalIdentityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "checkedAt" TIMESTAMPTZ(3),
    "fetchedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalIdentity_verifiedAt_fetchedAt_idx" ON "users"."ExternalIdentity"("verifiedAt", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_userId_kind_value_key" ON "users"."ExternalIdentity"("userId", "kind", "value");

-- CreateIndex
CREATE INDEX "TeacherSkill_identityId_idx" ON "users"."TeacherSkill"("identityId");

-- AddForeignKey
ALTER TABLE "users"."TeacherSkill" ADD CONSTRAINT "TeacherSkill_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "users"."ExternalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

