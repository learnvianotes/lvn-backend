-- CreateEnum
CREATE TYPE "notes"."NoteShareSource" AS ENUM ('DIRECT', 'CONNECTIONS');

-- CreateEnum
CREATE TYPE "users"."ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "users"."TeacherSkillKind" AS ENUM ('SKILL', 'QUALIFICATION', 'EXPERIENCE');

-- CreateEnum
CREATE TYPE "users"."TeacherSkillSource" AS ENUM ('MANUAL');

-- AlterTable
ALTER TABLE "notes"."Note" ADD COLUMN     "sharedWithConnections" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notes"."NoteShare" ADD COLUMN     "source" "notes"."NoteShareSource" NOT NULL DEFAULT 'DIRECT';

-- CreateTable
CREATE TABLE "users"."Connection" (
    "userLowId" UUID NOT NULL,
    "userHighId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("userLowId","userHighId")
);

-- CreateTable
CREATE TABLE "users"."ConnectionRequest" (
    "id" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "status" "users"."ConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."TeacherProfile" (
    "userId" UUID NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "users"."TeacherSkill" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "users"."TeacherSkillKind" NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "position" INTEGER NOT NULL,
    "source" "users"."TeacherSkillSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Connection_userHighId_idx" ON "users"."Connection"("userHighId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_toUserId_status_createdAt_idx" ON "users"."ConnectionRequest"("toUserId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ConnectionRequest_fromUserId_status_createdAt_idx" ON "users"."ConnectionRequest"("fromUserId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TeacherSkill_userId_position_idx" ON "users"."TeacherSkill"("userId", "position");

-- AddForeignKey
ALTER TABLE "users"."Connection" ADD CONSTRAINT "Connection_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Connection" ADD CONSTRAINT "Connection_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."TeacherSkill" ADD CONSTRAINT "TeacherSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

