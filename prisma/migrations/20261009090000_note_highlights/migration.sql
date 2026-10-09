-- CreateEnum
CREATE TYPE "notes"."HighlightKind" AS ENUM ('TEXT', 'AREA');

-- CreateEnum
CREATE TYPE "notes"."HighlightColor" AS ENUM ('YELLOW', 'GREEN', 'BLUE', 'PINK', 'PURPLE');

-- CreateTable
CREATE TABLE "notes"."NoteHighlight" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "page" INTEGER NOT NULL,
    "kind" "notes"."HighlightKind" NOT NULL,
    "color" "notes"."HighlightColor" NOT NULL,
    "rects" JSONB NOT NULL,
    "quote" TEXT,
    "comment" TEXT,
    "cardId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NoteHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteHighlight_noteId_fileId_page_idx" ON "notes"."NoteHighlight"("noteId", "fileId", "page");

-- AddForeignKey
ALTER TABLE "notes"."NoteHighlight" ADD CONSTRAINT "NoteHighlight_noteId_fileId_fkey" FOREIGN KEY ("noteId", "fileId") REFERENCES "notes"."NoteAttachment"("noteId", "fileId") ON DELETE CASCADE ON UPDATE CASCADE;

