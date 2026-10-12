-- CreateEnum
CREATE TYPE "core"."CommentTargetType" AS ENUM ('NOTE', 'GROUP_POST', 'CLASSROOM_POST');

-- CreateEnum
CREATE TYPE "core"."CommentState" AS ENUM ('VISIBLE', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "core"."ReactionTargetType" AS ENUM ('NOTE', 'COMMENT', 'GROUP_POST', 'CLASSROOM_POST');

-- CreateEnum
CREATE TYPE "core"."ReactionKind" AS ENUM ('LIKE', 'HELPFUL', 'CELEBRATE');

-- CreateTable
CREATE TABLE "core"."Comment" (
    "id" UUID NOT NULL,
    "targetType" "core"."CommentTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "cardId" UUID,
    "parentId" UUID,
    "authorId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "visibleTo" UUID,
    "body" JSONB NOT NULL,
    "state" "core"."CommentState" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Reaction" (
    "targetType" "core"."ReactionTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "core"."ReactionKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("targetType","targetId","userId")
);

-- CreateIndex
CREATE INDEX "Comment_targetType_targetId_parentId_createdAt_idx" ON "core"."Comment"("targetType", "targetId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "core"."Comment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "core"."Comment"("authorId");

-- CreateIndex
CREATE INDEX "Reaction_targetType_targetId_kind_idx" ON "core"."Reaction"("targetType", "targetId", "kind");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "core"."Reaction"("userId");

-- AddForeignKey
ALTER TABLE "core"."Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "core"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

