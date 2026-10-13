-- Rhythm (P6d, ADR-0069): planned days on the learner's settings, pauses, and closed weeks with the target they had.

-- CreateEnum
CREATE TYPE "core"."RhythmPauseReason" AS ENUM ('EXAMS', 'ILLNESS', 'FESTIVAL', 'TRAVEL', 'OTHER');

-- AlterTable
ALTER TABLE "core"."LearnerSettings" ADD COLUMN     "plannedDays" INTEGER[] DEFAULT ARRAY[1, 2, 4, 6]::INTEGER[];

-- CreateTable
CREATE TABLE "core"."RhythmPause" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "reason" "core"."RhythmPauseReason" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RhythmPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."RhythmWeek" (
    "userId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "countedDays" INTEGER NOT NULL,
    "comebacks" INTEGER NOT NULL,
    "pausedDays" INTEGER NOT NULL,
    "met" BOOLEAN NOT NULL,
    "closedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RhythmWeek_pkey" PRIMARY KEY ("userId","weekStart")
);

-- CreateIndex
CREATE INDEX "RhythmPause_userId_from_idx" ON "core"."RhythmPause"("userId", "from");

