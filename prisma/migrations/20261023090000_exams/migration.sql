-- Exams, plan tasks and quiz results by topic (P6e, ADR-0070).

-- CreateTable
CREATE TABLE "core"."Exam" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ExamTopic" (
    "examId" UUID NOT NULL,
    "topicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ExamTopic_pkey" PRIMARY KEY ("examId","topicKey")
);

-- CreateTable
CREATE TABLE "core"."ExamPlanTask" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "topicKeys" TEXT[],
    "remindedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ExamPlanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TopicQuizResult" (
    "userId" UUID NOT NULL,
    "topicKey" TEXT NOT NULL,
    "eventId" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "answered" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,

    CONSTRAINT "TopicQuizResult_pkey" PRIMARY KEY ("userId","topicKey","eventId")
);

-- CreateIndex
CREATE INDEX "Exam_userId_date_idx" ON "core"."Exam"("userId", "date");

-- CreateIndex
CREATE INDEX "ExamPlanTask_userId_day_idx" ON "core"."ExamPlanTask"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPlanTask_examId_day_key" ON "core"."ExamPlanTask"("examId", "day");

-- CreateIndex
CREATE INDEX "TopicQuizResult_userId_topicKey_at_idx" ON "core"."TopicQuizResult"("userId", "topicKey", "at" DESC);

-- AddForeignKey
ALTER TABLE "core"."ExamTopic" ADD CONSTRAINT "ExamTopic_examId_fkey" FOREIGN KEY ("examId") REFERENCES "core"."Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ExamPlanTask" ADD CONSTRAINT "ExamPlanTask_examId_fkey" FOREIGN KEY ("examId") REFERENCES "core"."Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

