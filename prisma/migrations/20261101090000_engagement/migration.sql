-- AlterEnum
ALTER TYPE "comms"."NotificationCategory" ADD VALUE 'ACHIEVEMENT';

-- CreateEnum
CREATE TYPE "core"."PointsRule" AS ENUM ('REACTION', 'FORK', 'RESOURCE_APPROVED');

-- CreateEnum
CREATE TYPE "core"."PointsSource" AS ENUM ('NOTE', 'RESOURCE');

-- CreateEnum
CREATE TYPE "core"."AchievementKind" AS ENUM ('TOPICS_MASTERED', 'QUIZ_MASTER', 'EXAM_READY', 'RHYTHM_WEEKS', 'SUBJECT_CONTRIBUTOR');

-- AlterTable
ALTER TABLE "core"."LearnerSettings" ADD COLUMN     "showAchievements" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "core"."PointsEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "rule" "core"."PointsRule" NOT NULL,
    "sourceType" "core"."PointsSource" NOT NULL,
    "sourceId" UUID NOT NULL,
    "actorId" UUID,
    "subjectId" UUID,
    "subjectTitle" TEXT,
    "awardKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Achievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "core"."AchievementKind" NOT NULL,
    "tier" INTEGER NOT NULL,
    "subjectId" UUID,
    "subjectTitle" TEXT,
    "key" TEXT NOT NULL,
    "earnedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_awardKey_key" ON "core"."PointsEntry"("awardKey");

-- CreateIndex
CREATE INDEX "PointsEntry_userId_createdAt_idx" ON "core"."PointsEntry"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PointsEntry_sourceType_sourceId_idx" ON "core"."PointsEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "PointsEntry_actorId_userId_createdAt_idx" ON "core"."PointsEntry"("actorId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Achievement_userId_earnedAt_idx" ON "core"."Achievement"("userId", "earnedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_key_key" ON "core"."Achievement"("userId", "key");

