-- CreateEnum
CREATE TYPE "core"."MockInterviewLevel" AS ENUM ('INTRO', 'CORE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "core"."MockInterviewKind" AS ENUM ('PEER', 'TEACHER', 'SELF');

-- CreateEnum
CREATE TYPE "core"."MockInterviewStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "core"."MockInterviewTemplate" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "topicKey" TEXT,
    "level" "core"."MockInterviewLevel" NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."MockInterviewQuestion" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "signals" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "MockInterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."InterviewRubricCriterion" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "levels" TEXT[],
    "position" INTEGER NOT NULL,

    CONSTRAINT "InterviewRubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."InterviewSlot" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."MockInterview" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "slotId" UUID,
    "candidateId" UUID NOT NULL,
    "interviewerId" UUID,
    "kind" "core"."MockInterviewKind" NOT NULL,
    "status" "core"."MockInterviewStatus" NOT NULL DEFAULT 'REQUESTED',
    "recordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."InterviewFeedback" (
    "id" UUID NOT NULL,
    "interviewId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "scores" JSONB NOT NULL,
    "strengths" TEXT,
    "nextSteps" TEXT,
    "visibleToCandidate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockInterviewQuestion_templateId_position_idx" ON "core"."MockInterviewQuestion"("templateId", "position");

-- CreateIndex
CREATE INDEX "InterviewRubricCriterion_templateId_position_idx" ON "core"."InterviewRubricCriterion"("templateId", "position");

-- CreateIndex
CREATE INDEX "InterviewSlot_hostId_startsAt_idx" ON "core"."InterviewSlot"("hostId", "startsAt");

-- CreateIndex
CREATE INDEX "MockInterview_candidateId_createdAt_idx" ON "core"."MockInterview"("candidateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewId_idx" ON "core"."InterviewFeedback"("interviewId");

-- AddForeignKey
ALTER TABLE "core"."MockInterviewQuestion" ADD CONSTRAINT "MockInterviewQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "core"."MockInterviewTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."InterviewRubricCriterion" ADD CONSTRAINT "InterviewRubricCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "core"."MockInterviewTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MockInterview" ADD CONSTRAINT "MockInterview_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "core"."MockInterviewTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MockInterview" ADD CONSTRAINT "MockInterview_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "core"."InterviewSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "core"."MockInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

