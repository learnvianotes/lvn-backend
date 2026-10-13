-- Focus sessions, Rhythm buddies, sharing Rhythm with classes, and the RHYTHM_BUDDY notification (P6g, ADR-0072).

-- CreateEnum
CREATE TYPE "core"."RhythmBuddyStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterEnum
ALTER TYPE "comms"."NotificationCategory" ADD VALUE 'RHYTHM_BUDDY';

-- AlterTable
ALTER TABLE "core"."LearnerSettings" ADD COLUMN     "shareRhythm" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "core"."FocusSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "topicKey" TEXT,
    "noteId" UUID,
    "plannedMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "meetUrl" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "focusedSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."RhythmBuddy" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "addresseeId" UUID NOT NULL,
    "status" "core"."RhythmBuddyStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RhythmBuddy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusSession_userId_endedAt_idx" ON "core"."FocusSession"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "FocusSession_endedAt_startedAt_idx" ON "core"."FocusSession"("endedAt", "startedAt");

-- CreateIndex
CREATE INDEX "RhythmBuddy_addresseeId_status_idx" ON "core"."RhythmBuddy"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RhythmBuddy_requesterId_addresseeId_key" ON "core"."RhythmBuddy"("requesterId", "addresseeId");

