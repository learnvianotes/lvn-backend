-- CreateEnum
CREATE TYPE "core"."ContestStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "core"."LearnerSettings" ADD COLUMN     "contestBands" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "core"."Contest" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" UUID,
    "subjectTitle" TEXT,
    "opensAt" TIMESTAMPTZ(3) NOT NULL,
    "closesAt" TIMESTAMPTZ(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "status" "core"."ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ContestQuestion" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correctChoiceId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ContestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ContestAttempt" (
    "id" UUID NOT NULL,
    "contestId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "questionIds" TEXT[],
    "choiceOrder" JSONB NOT NULL,
    "score" INTEGER,
    "total" INTEGER NOT NULL,

    CONSTRAINT "ContestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ContestAnswer" (
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "choiceId" TEXT NOT NULL,
    "answeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestAnswer_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateIndex
CREATE INDEX "Contest_status_opensAt_idx" ON "core"."Contest"("status", "opensAt");

-- CreateIndex
CREATE INDEX "ContestQuestion_contestId_position_idx" ON "core"."ContestQuestion"("contestId", "position");

-- CreateIndex
CREATE INDEX "ContestAttempt_userId_startedAt_idx" ON "core"."ContestAttempt"("userId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ContestAttempt_contestId_userId_key" ON "core"."ContestAttempt"("contestId", "userId");

-- AddForeignKey
ALTER TABLE "core"."ContestQuestion" ADD CONSTRAINT "ContestQuestion_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "core"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ContestAttempt" ADD CONSTRAINT "ContestAttempt_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "core"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ContestAnswer" ADD CONSTRAINT "ContestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "core"."ContestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

