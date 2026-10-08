-- CreateEnum
CREATE TYPE "notes"."NoteImportStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'NEEDS_CONFIRMATION');

-- CreateTable
CREATE TABLE "notes"."NoteImport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "checksum" TEXT,
    "allowDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "status" "notes"."NoteImportStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "NoteImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteImport_userId_createdAt_idx" ON "notes"."NoteImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteImport_userId_checksum_idx" ON "notes"."NoteImport"("userId", "checksum");

