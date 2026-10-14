-- CreateEnum
CREATE TYPE "core"."WeeklyTaskKind" AS ENUM ('REVIEWS', 'QUIZ_ANSWERS', 'TOPIC_MINUTES');

-- CreateTable
CREATE TABLE "core"."WeeklyTask" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "kind" "core"."WeeklyTaskKind" NOT NULL,
    "target" INTEGER NOT NULL,
    "topicKey" TEXT,
    "topicTitle" TEXT,
    "plan" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ClassGoal" (
    "classroomId" UUID NOT NULL,
    "target" INTEGER,
    "setById" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassGoal_pkey" PRIMARY KEY ("classroomId")
);

-- CreateIndex
CREATE INDEX "WeeklyTask_userId_weekStart_idx" ON "core"."WeeklyTask"("userId", "weekStart");

