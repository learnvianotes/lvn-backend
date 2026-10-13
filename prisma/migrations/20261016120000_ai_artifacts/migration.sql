-- CreateEnum
CREATE TYPE "ai"."AiArtifactStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "ai"."NoteArtifact" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "versionId" UUID,
    "ownerId" UUID,
    "task" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "status" "ai"."AiArtifactStatus" NOT NULL,
    "payload" JSONB,
    "error" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "keptAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NoteArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteArtifact_ownerId_noteId_createdAt_idx" ON "ai"."NoteArtifact"("ownerId", "noteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NoteArtifact_noteId_task_idx" ON "ai"."NoteArtifact"("noteId", "task");

