-- CreateEnum
CREATE TYPE "core"."ResourceType" AS ENUM ('BOOK', 'COURSE', 'TOOL', 'SOFTWARE', 'HARDWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "core"."ResourceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "comms"."NotificationCategory" ADD VALUE 'RESOURCE';

-- AlterEnum
ALTER TYPE "core"."ReportEntityType" ADD VALUE 'RESOURCE';

-- CreateTable
CREATE TABLE "core"."Resource" (
    "id" UUID NOT NULL,
    "type" "core"."ResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "isbn" TEXT,
    "author" TEXT,
    "coverFileId" UUID,
    "submittedById" UUID NOT NULL,
    "status" "core"."ResourceStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ResourceTopic" (
    "resourceId" UUID NOT NULL,
    "topicId" UUID NOT NULL,

    CONSTRAINT "ResourceTopic_pkey" PRIMARY KEY ("resourceId","topicId")
);

-- CreateIndex
CREATE INDEX "Resource_status_createdAt_idx" ON "core"."Resource"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Resource_submittedById_createdAt_idx" ON "core"."Resource"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "Resource_urlKey_idx" ON "core"."Resource"("urlKey");

-- CreateIndex
CREATE INDEX "Resource_isbn_idx" ON "core"."Resource"("isbn");

-- CreateIndex
CREATE INDEX "ResourceTopic_topicId_idx" ON "core"."ResourceTopic"("topicId");

-- AddForeignKey
ALTER TABLE "core"."ResourceTopic" ADD CONSTRAINT "ResourceTopic_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "core"."Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

