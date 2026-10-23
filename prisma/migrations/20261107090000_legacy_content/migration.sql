-- ADR-0098: the ledger of the old site's study content import (one row per topic or problem written as a note).

-- CreateTable
CREATE TABLE "notes"."LegacyContentItem" (
    "key" TEXT NOT NULL,
    "noteId" UUID NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "versionId" UUID,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LegacyContentItem_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyContentItem_noteId_key" ON "notes"."LegacyContentItem"("noteId");

-- AddForeignKey
ALTER TABLE "notes"."LegacyContentItem" ADD CONSTRAINT "LegacyContentItem_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
