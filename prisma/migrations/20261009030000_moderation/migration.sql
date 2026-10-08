-- CreateEnum
CREATE TYPE "notes"."ModerationState" AS ENUM ('OK', 'PENDING_REVIEW', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "core"."ReportEntityType" AS ENUM ('NOTE', 'USER');

-- CreateEnum
CREATE TYPE "core"."ReportReason" AS ENUM ('HARASSMENT', 'SEXUAL', 'SELF_HARM', 'HATE', 'SPAM', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "core"."ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "core"."ModerationActionType" AS ENUM ('APPROVE', 'HIDE', 'REMOVE', 'WARN', 'SUSPEND', 'DISMISS');

-- CreateEnum
CREATE TYPE "core"."AppealStatus" AS ENUM ('OPEN', 'DECIDED');

-- AlterTable
ALTER TABLE "notes"."Note" ADD COLUMN     "moderation" "notes"."ModerationState" NOT NULL DEFAULT 'OK',
ADD COLUMN     "moderationReason" TEXT;

-- CreateTable
CREATE TABLE "core"."Report" (
    "id" UUID NOT NULL,
    "entityType" "core"."ReportEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "reporterId" UUID,
    "reason" "core"."ReportReason" NOT NULL,
    "details" TEXT,
    "status" "core"."ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ModerationAction" (
    "id" UUID NOT NULL,
    "entityType" "core"."ReportEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "core"."ModerationActionType" NOT NULL,
    "reason" TEXT,
    "actorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ModerationAppeal" (
    "id" UUID NOT NULL,
    "entityType" "core"."ReportEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "core"."AppealStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "core"."Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_entityType_entityId_idx" ON "core"."Report"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_entityType_entityId_reporterId_key" ON "core"."Report"("entityType", "entityId", "reporterId");

-- CreateIndex
CREATE INDEX "ModerationAction_entityType_entityId_createdAt_idx" ON "core"."ModerationAction"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAppeal_status_createdAt_idx" ON "core"."ModerationAppeal"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationAppeal_entityType_entityId_userId_key" ON "core"."ModerationAppeal"("entityType", "entityId", "userId");

