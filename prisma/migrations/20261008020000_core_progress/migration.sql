-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateEnum
CREATE TYPE "core"."ProgressOrigin" AS ENUM ('LEGACY', 'LVN');

-- CreateEnum
CREATE TYPE "core"."ProblemMark" AS ENUM ('SOLVED', 'REVISIT');

-- CreateTable
CREATE TABLE "core"."CoreTopicProgress" (
    "userId" UUID NOT NULL,
    "topicKey" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "origin" "core"."ProgressOrigin" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "revisit" BOOLEAN NOT NULL DEFAULT false,
    "secondsStudied" INTEGER NOT NULL DEFAULT 0,
    "lastStudiedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CoreTopicProgress_pkey" PRIMARY KEY ("userId","topicKey","origin")
);

-- CreateTable
CREATE TABLE "core"."CoreProblemMark" (
    "userId" UUID NOT NULL,
    "subjectId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "origin" "core"."ProgressOrigin" NOT NULL,
    "mark" "core"."ProblemMark" NOT NULL,
    "markedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoreProblemMark_pkey" PRIMARY KEY ("userId","subjectId","problemId","origin")
);

-- CreateIndex
CREATE INDEX "CoreTopicProgress_userId_subjectId_idx" ON "core"."CoreTopicProgress"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "CoreProblemMark_userId_subjectId_idx" ON "core"."CoreProblemMark"("userId", "subjectId");
