-- CreateEnum
CREATE TYPE "core"."GroupType" AS ENUM ('COMMUNITY', 'PROJECT');

-- CreateEnum
CREATE TYPE "core"."GroupPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "core"."GroupJoinPolicy" AS ENUM ('OPEN', 'APPROVAL');

-- CreateEnum
CREATE TYPE "core"."GroupRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'MENTOR');

-- CreateEnum
CREATE TYPE "core"."JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "comms"."Notification" ADD COLUMN     "groupId" UUID;

-- CreateTable
CREATE TABLE "core"."Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "core"."GroupType" NOT NULL DEFAULT 'COMMUNITY',
    "privacy" "core"."GroupPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "joinPolicy" "core"."GroupJoinPolicy" NOT NULL DEFAULT 'APPROVAL',
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."GroupMember" (
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "core"."GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "core"."GroupJoinRequest" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "core"."JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."GroupPost" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" JSONB NOT NULL,
    "pinnedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "GroupPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."GroupRead" (
    "id" UUID NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "GroupRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."GroupMemberRead" (
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "GroupMemberRead_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "notes"."GroupShare" (
    "noteId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "sharedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupShare_pkey" PRIMARY KEY ("noteId","groupId")
);

-- CreateIndex
CREATE INDEX "Group_privacy_deletedAt_createdAt_idx" ON "core"."Group"("privacy", "deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Group_ownerId_idx" ON "core"."Group"("ownerId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "core"."GroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupJoinRequest_groupId_status_createdAt_idx" ON "core"."GroupJoinRequest"("groupId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GroupJoinRequest_userId_status_idx" ON "core"."GroupJoinRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "GroupPost_groupId_deletedAt_createdAt_idx" ON "core"."GroupPost"("groupId", "deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GroupMemberRead_userId_groupId_idx" ON "notes"."GroupMemberRead"("userId", "groupId");

-- CreateIndex
CREATE INDEX "GroupShare_groupId_createdAt_idx" ON "notes"."GroupShare"("groupId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "core"."GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."GroupPost" ADD CONSTRAINT "GroupPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."GroupMemberRead" ADD CONSTRAINT "GroupMemberRead_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "notes"."GroupRead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."GroupShare" ADD CONSTRAINT "GroupShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."GroupShare" ADD CONSTRAINT "GroupShare_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "notes"."GroupRead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

