-- CreateEnum
CREATE TYPE "core"."GroupPostKind" AS ENUM ('POST', 'IDEA');

-- CreateEnum
CREATE TYPE "core"."RepositoryProvider" AS ENUM ('GITHUB', 'GITLAB');

-- CreateEnum
CREATE TYPE "core"."DoubtStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "notes"."ContributorRole" AS ENUM ('CONTRIBUTOR', 'MENTOR');

-- AlterTable
ALTER TABLE "core"."Group" ADD COLUMN     "showcaseNoteId" UUID;

-- AlterTable
ALTER TABLE "core"."GroupPost" ADD COLUMN     "kind" "core"."GroupPostKind" NOT NULL DEFAULT 'POST';

-- CreateTable
CREATE TABLE "core"."GroupRepository" (
    "groupId" UUID NOT NULL,
    "provider" "core"."RepositoryProvider" NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "refreshedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRepository_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "core"."Doubt" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "repoRef" TEXT,
    "status" "core"."DoubtStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Doubt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."DoubtAnswer" (
    "id" UUID NOT NULL,
    "doubtId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" JSONB NOT NULL,
    "byMentor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "DoubtAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."MentorInvite" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "invitedBy" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."ProjectContributor" (
    "noteId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "role" "notes"."ContributorRole" NOT NULL,

    CONSTRAINT "ProjectContributor_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateIndex
CREATE INDEX "GroupRepository_refreshedAt_idx" ON "core"."GroupRepository"("refreshedAt");

-- CreateIndex
CREATE INDEX "Doubt_groupId_deletedAt_status_createdAt_idx" ON "core"."Doubt"("groupId", "deletedAt", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DoubtAnswer_doubtId_createdAt_idx" ON "core"."DoubtAnswer"("doubtId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorInvite_teacherId_acceptedAt_declinedAt_idx" ON "core"."MentorInvite"("teacherId", "acceptedAt", "declinedAt");

-- CreateIndex
CREATE INDEX "MentorInvite_groupId_idx" ON "core"."MentorInvite"("groupId");

-- CreateIndex
CREATE INDEX "ProjectContributor_userId_idx" ON "notes"."ProjectContributor"("userId");

-- AddForeignKey
ALTER TABLE "core"."GroupRepository" ADD CONSTRAINT "GroupRepository_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Doubt" ADD CONSTRAINT "Doubt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."DoubtAnswer" ADD CONSTRAINT "DoubtAnswer_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "core"."Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MentorInvite" ADD CONSTRAINT "MentorInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."ProjectContributor" ADD CONSTRAINT "ProjectContributor_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

