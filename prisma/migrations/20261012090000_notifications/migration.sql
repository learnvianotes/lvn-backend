-- The communication context's schema (§6.1), first used for notifications (ADR-0042).
CREATE SCHEMA IF NOT EXISTS "comms";

-- CreateEnum
CREATE TYPE "comms"."NotificationCategory" AS ENUM ('COMMENT', 'SHARE', 'CLASSROOM_POST', 'QUIZ_PUBLISHED', 'REVISION_REMINDER', 'STREAK_AT_RISK', 'JOIN_REQUEST', 'JOIN_DECISION', 'FOLLOW', 'CONNECTION', 'MENTOR_INVITE', 'DOUBT', 'FORK_PUBLISHED', 'VERIFICATION', 'DATA_EXPORT', 'NOTES_IMPORT');

-- CreateTable
CREATE TABLE "comms"."Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "comms"."NotificationCategory" NOT NULL,
    "path" TEXT NOT NULL,
    "actorId" UUID,
    "noteId" UUID,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "comms"."Notification"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "comms"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_actorId_idx" ON "comms"."Notification"("actorId");
