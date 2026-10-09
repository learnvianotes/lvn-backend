-- CreateEnum
CREATE TYPE "notes"."PdfConversionStatus" AS ENUM ('QUEUED', 'TRIAGE', 'PARSING', 'MAPPING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "notes"."PdfConversion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceNoteId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "status" "notes"."PdfConversionStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER,
    "scannedPages" INTEGER,
    "cards" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PdfConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfConversion_userId_createdAt_idx" ON "notes"."PdfConversion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfConversion_noteId_createdAt_idx" ON "notes"."PdfConversion"("noteId", "createdAt");

-- AddForeignKey
ALTER TABLE "notes"."PdfConversion" ADD CONSTRAINT "PdfConversion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

