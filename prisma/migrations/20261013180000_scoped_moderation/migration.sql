-- CreateEnum
CREATE TYPE "core"."ModerationScope" AS ENUM ('PLATFORM', 'GROUP', 'CLASSROOM');

-- CreateEnum
CREATE TYPE "core"."ContentModeration" AS ENUM ('OK', 'PENDING_REVIEW', 'HIDDEN', 'REMOVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "core"."ReportEntityType" ADD VALUE 'COMMENT';
ALTER TYPE "core"."ReportEntityType" ADD VALUE 'GROUP_POST';
ALTER TYPE "core"."ReportEntityType" ADD VALUE 'CLASSROOM_POST';
ALTER TYPE "core"."ReportEntityType" ADD VALUE 'DOUBT';
ALTER TYPE "core"."ReportEntityType" ADD VALUE 'GROUP';

-- AlterEnum
ALTER TYPE "comms"."NotificationCategory" ADD VALUE 'MODERATION';

-- AlterTable
ALTER TABLE "core"."Report" ADD COLUMN     "scope" "core"."ModerationScope" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "scopeId" UUID;

-- AlterTable
ALTER TABLE "core"."ModerationAction" ADD COLUMN     "scope" "core"."ModerationScope" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "scopeId" UUID;

-- AlterTable
ALTER TABLE "core"."ModerationAppeal" ADD COLUMN     "scope" "core"."ModerationScope" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "scopeId" UUID;

-- AlterTable
ALTER TABLE "core"."GroupPost" ADD COLUMN     "moderation" "core"."ContentModeration" NOT NULL DEFAULT 'OK',
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "core"."ClassroomPost" ADD COLUMN     "moderation" "core"."ContentModeration" NOT NULL DEFAULT 'OK',
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "core"."Comment" ADD COLUMN     "moderation" "core"."ContentModeration" NOT NULL DEFAULT 'OK',
ADD COLUMN     "moderationReason" TEXT;

-- AlterTable
ALTER TABLE "core"."Doubt" ADD COLUMN     "moderation" "core"."ContentModeration" NOT NULL DEFAULT 'OK',
ADD COLUMN     "moderationReason" TEXT;

-- CreateIndex
CREATE INDEX "Report_scope_scopeId_status_idx" ON "core"."Report"("scope", "scopeId", "status");

