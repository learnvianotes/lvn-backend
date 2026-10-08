-- CreateTable
CREATE TABLE "notes"."NoteSearchDocument" (
    "noteId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "document" tsvector,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NoteSearchDocument_pkey" PRIMARY KEY ("noteId")
);

-- CreateIndex
CREATE INDEX "NoteSearchDocument_document_idx" ON "notes"."NoteSearchDocument" USING GIN ("document");

-- CreateIndex
CREATE INDEX "NoteSearchDocument_title_idx" ON "notes"."NoteSearchDocument" USING GIN ("title" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "notes"."NoteSearchDocument" ADD CONSTRAINT "NoteSearchDocument_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

