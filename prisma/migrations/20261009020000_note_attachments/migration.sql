-- CreateTable
CREATE TABLE "notes"."NoteAttachment" (
    "noteId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAttachment_pkey" PRIMARY KEY ("noteId","fileId")
);

-- CreateIndex
CREATE INDEX "NoteAttachment_fileId_idx" ON "notes"."NoteAttachment"("fileId");

-- AddForeignKey
ALTER TABLE "notes"."NoteAttachment" ADD CONSTRAINT "NoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteAttachment" ADD CONSTRAINT "NoteAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "notes"."FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

