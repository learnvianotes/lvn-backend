-- CreateEnum
CREATE TYPE "core"."RepositoryEventKind" AS ENUM ('PUSH', 'PULL_REQUEST', 'ISSUE');

-- AlterTable
ALTER TABLE "core"."GroupRepository" ADD COLUMN     "installationId" TEXT;

-- CreateTable
CREATE TABLE "core"."GitHubInstallation" (
    "id" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."GitHubDelivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMPTZ(3),

    CONSTRAINT "GitHubDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."RepositoryEvent" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "kind" "core"."RepositoryEventKind" NOT NULL,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" INTEGER,
    "authorLogin" TEXT,
    "url" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitHubDelivery_receivedAt_idx" ON "core"."GitHubDelivery"("receivedAt");

-- CreateIndex
CREATE INDEX "RepositoryEvent_groupId_at_idx" ON "core"."RepositoryEvent"("groupId", "at" DESC);

-- CreateIndex
CREATE INDEX "GroupRepository_installationId_idx" ON "core"."GroupRepository"("installationId");

-- AddForeignKey
ALTER TABLE "core"."GroupRepository" ADD CONSTRAINT "GroupRepository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "core"."GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."RepositoryEvent" ADD CONSTRAINT "RepositoryEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "core"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

