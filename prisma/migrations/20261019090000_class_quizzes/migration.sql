-- CreateTable
CREATE TABLE "core"."ClassQuiz" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sourceNoteId" UUID,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClassQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ClassQuizQuestion" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL,

    CONSTRAINT "ClassQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."QuizAttempt" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientOpId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."QuizAnswer" (
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "choiceIds" TEXT[],
    "correct" BOOLEAN NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateIndex
CREATE INDEX "ClassQuiz_classroomId_deletedAt_publishedAt_idx" ON "core"."ClassQuiz"("classroomId", "deletedAt", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "ClassQuiz_authorId_idx" ON "core"."ClassQuiz"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassQuizQuestion_quizId_position_key" ON "core"."ClassQuizQuestion"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_clientOpId_key" ON "core"."QuizAttempt"("clientOpId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_userId_submittedAt_idx" ON "core"."QuizAttempt"("quizId", "userId", "submittedAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "core"."QuizAttempt"("userId");

-- AddForeignKey
ALTER TABLE "core"."ClassQuiz" ADD CONSTRAINT "ClassQuiz_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "core"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ClassQuizQuestion" ADD CONSTRAINT "ClassQuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "core"."ClassQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "core"."ClassQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "core"."QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "core"."ClassQuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

