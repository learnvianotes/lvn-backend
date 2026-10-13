-- Flashcard reviews with FSRS (P6c, ADR-0068): the notes a person chose to study, each card's state, and every grade.

-- CreateTable
CREATE TABLE "core"."StudyNote" (
    "userId" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("userId","noteId")
);

-- CreateTable
CREATE TABLE "core"."CardReview" (
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "due" TIMESTAMPTZ(3) NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL,
    "lapses" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "lastReview" TIMESTAMPTZ(3),
    "firstReviewAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CardReview_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "core"."CardReviewLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "clientOpId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardReview_userId_due_idx" ON "core"."CardReview"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "CardReviewLog_clientOpId_key" ON "core"."CardReviewLog"("clientOpId");

-- CreateIndex
CREATE INDEX "CardReviewLog_userId_cardId_reviewedAt_idx" ON "core"."CardReviewLog"("userId", "cardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "CardReviewLog_userId_reviewedAt_idx" ON "core"."CardReviewLog"("userId", "reviewedAt");

