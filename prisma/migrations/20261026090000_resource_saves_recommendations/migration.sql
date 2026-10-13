-- CreateEnum
CREATE TYPE "core"."ResourceRecommendationTarget" AS ENUM ('USER', 'GROUP', 'CLASSROOM');

-- AlterEnum
ALTER TYPE "core"."CommentTargetType" ADD VALUE 'RESOURCE';

-- AlterEnum
ALTER TYPE "core"."RecommendationKind" ADD VALUE 'RESOURCE';

-- AlterEnum
ALTER TYPE "notes"."SearchEntity" ADD VALUE 'RESOURCE';

-- CreateTable
CREATE TABLE "core"."ResourceSave" (
    "resourceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceSave_pkey" PRIMARY KEY ("resourceId","userId")
);

-- CreateTable
CREATE TABLE "core"."ResourceRecommendation" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "targetType" "core"."ResourceRecommendationTarget" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceSave_userId_createdAt_idx" ON "core"."ResourceSave"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceSave_resourceId_createdAt_idx" ON "core"."ResourceSave"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRecommendation_targetType_targetId_createdAt_idx" ON "core"."ResourceRecommendation"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "ResourceRecommendation_fromUserId_idx" ON "core"."ResourceRecommendation"("fromUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRecommendation_resourceId_targetType_targetId_fromU_key" ON "core"."ResourceRecommendation"("resourceId", "targetType", "targetId", "fromUserId");

-- AddForeignKey
ALTER TABLE "core"."ResourceSave" ADD CONSTRAINT "ResourceSave_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "core"."Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ResourceRecommendation" ADD CONSTRAINT "ResourceRecommendation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "core"."Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

