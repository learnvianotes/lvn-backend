-- CreateEnum
CREATE TYPE "users"."DataExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notes"."FileParentType" ADD VALUE 'IMPORT_JOB';
ALTER TYPE "notes"."FileParentType" ADD VALUE 'DATA_EXPORT';

-- CreateTable
CREATE TABLE "users"."DataExport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "users"."DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileId" UUID,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataExport_userId_requestedAt_idx" ON "users"."DataExport"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "DataExport_status_expiresAt_idx" ON "users"."DataExport"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "users"."DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

