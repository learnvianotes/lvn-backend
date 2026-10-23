-- AlterTable
ALTER TABLE "users"."VerificationRequest" ADD COLUMN "collegeIdCard" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VerificationRequest_collegeIdCard_status_createdAt_idx" ON "users"."VerificationRequest"("collegeIdCard", "status", "createdAt");

-- CreateTable
CREATE TABLE "users"."AppSetting" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- AlterEnum
ALTER TYPE "notes"."FilePurpose" ADD VALUE 'COLLEGE_ID';
