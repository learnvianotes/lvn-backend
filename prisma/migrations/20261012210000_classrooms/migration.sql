-- CreateEnum
CREATE TYPE "core"."ClassroomRole" AS ENUM ('TEACHER', 'TA', 'STUDENT');

-- CreateEnum
CREATE TYPE "core"."JoinVia" AS ENUM ('CODE', 'LINK');

-- AlterEnum
ALTER TYPE "comms"."NotificationCategory" ADD VALUE 'CLASSROOM_INVITE';

-- AlterTable
ALTER TABLE "comms"."Notification" ADD COLUMN     "classroomId" UUID;

-- CreateTable
CREATE TABLE "core"."Classroom" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ClassroomMember" (
    "classroomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "core"."ClassroomRole" NOT NULL DEFAULT 'STUDENT',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMember_pkey" PRIMARY KEY ("classroomId","userId")
);

-- CreateTable
CREATE TABLE "core"."ClassroomJoinRequest" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "via" "core"."JoinVia" NOT NULL DEFAULT 'CODE',
    "status" "core"."JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ClassroomInvite" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "invitedUserId" UUID NOT NULL,
    "invitedBy" UUID NOT NULL,
    "role" "core"."ClassroomRole" NOT NULL DEFAULT 'STUDENT',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ClassroomPost" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClassroomPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."ClassroomRead" (
    "id" UUID NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClassroomRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."ClassroomMemberRead" (
    "classroomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "ClassroomMemberRead_pkey" PRIMARY KEY ("classroomId","userId")
);

-- CreateTable
CREATE TABLE "notes"."ClassroomShare" (
    "noteId" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "sharedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomShare_pkey" PRIMARY KEY ("noteId","classroomId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "core"."Classroom"("joinCode");

-- CreateIndex
CREATE INDEX "Classroom_ownerId_idx" ON "core"."Classroom"("ownerId");

-- CreateIndex
CREATE INDEX "ClassroomMember_userId_idx" ON "core"."ClassroomMember"("userId");

-- CreateIndex
CREATE INDEX "ClassroomJoinRequest_classroomId_status_createdAt_idx" ON "core"."ClassroomJoinRequest"("classroomId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassroomJoinRequest_userId_status_idx" ON "core"."ClassroomJoinRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "ClassroomInvite_invitedUserId_expiresAt_idx" ON "core"."ClassroomInvite"("invitedUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "ClassroomInvite_classroomId_idx" ON "core"."ClassroomInvite"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomPost_classroomId_deletedAt_createdAt_idx" ON "core"."ClassroomPost"("classroomId", "deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClassroomMemberRead_userId_classroomId_idx" ON "notes"."ClassroomMemberRead"("userId", "classroomId");

-- CreateIndex
CREATE INDEX "ClassroomShare_classroomId_createdAt_idx" ON "notes"."ClassroomShare"("classroomId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "core"."ClassroomMember" ADD CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "core"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ClassroomJoinRequest" ADD CONSTRAINT "ClassroomJoinRequest_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "core"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ClassroomInvite" ADD CONSTRAINT "ClassroomInvite_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "core"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ClassroomPost" ADD CONSTRAINT "ClassroomPost_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "core"."Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."ClassroomMemberRead" ADD CONSTRAINT "ClassroomMemberRead_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "notes"."ClassroomRead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."ClassroomShare" ADD CONSTRAINT "ClassroomShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."ClassroomShare" ADD CONSTRAINT "ClassroomShare_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "notes"."ClassroomRead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

