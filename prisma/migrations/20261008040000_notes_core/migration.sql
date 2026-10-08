-- Phase 2 (P2a): the notes core — subjects and topics, folders, tags, notes, cards, versions, user shares (spec §4,
-- docs/architecture/erd.md). Card.position is a fractional index compared byte-wise (COLLATE "C"), as the clients compare
-- it; Prisma does not model collations, so this is the one hand edit to the generated SQL.

-- CreateEnum
CREATE TYPE "notes"."NoteKind" AS ENUM ('NOTE', 'BLOG', 'POST', 'PROJECT');

-- CreateEnum
CREATE TYPE "notes"."Visibility" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "notes"."CardType" AS ENUM ('text', 'heading', 'markdown', 'code', 'image', 'video', 'audio', 'file', 'diagram', 'quote', 'callout', 'checklist', 'table', 'question', 'quiz', 'flashcard');

-- CreateEnum
CREATE TYPE "notes"."NoteVersionKind" AS ENUM ('PUBLISHED', 'CONFLICT', 'DRAFT');

-- CreateEnum
CREATE TYPE "notes"."NoteShareRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "notes"."TopicOrigin" AS ENUM ('CURATED', 'PROPOSED');

-- CreateTable
CREATE TABLE "notes"."Subject" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."Topic" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "parentId" UUID,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" "notes"."TopicOrigin" NOT NULL,
    "proposedById" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."Folder" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."Tag" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."Note" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "folderId" UUID,
    "kind" "notes"."NoteKind" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT 'note',
    "visibility" "notes"."Visibility" NOT NULL DEFAULT 'PRIVATE',
    "draftRevision" INTEGER NOT NULL DEFAULT 0,
    "draftUpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedVersionId" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "forkingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."Card" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "position" TEXT COLLATE "C" NOT NULL,
    "type" "notes"."CardType" NOT NULL,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."NoteVersion" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "notes"."NoteVersionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."NoteShare" (
    "noteId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "notes"."NoteShareRole" NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteShare_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateTable
CREATE TABLE "notes"."NoteTag" (
    "noteId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("noteId","tagId")
);

-- CreateTable
CREATE TABLE "notes"."NoteTopic" (
    "noteId" UUID NOT NULL,
    "topicId" UUID NOT NULL,

    CONSTRAINT "NoteTopic_pkey" PRIMARY KEY ("noteId","topicId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "notes"."Subject"("slug");

-- CreateIndex
CREATE INDEX "Topic_proposedById_idx" ON "notes"."Topic"("proposedById");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_slug_key" ON "notes"."Topic"("subjectId", "slug");

-- CreateIndex
CREATE INDEX "Folder_ownerId_parentId_idx" ON "notes"."Folder"("ownerId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_ownerId_name_key" ON "notes"."Tag"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Note_publishedVersionId_key" ON "notes"."Note"("publishedVersionId");

-- CreateIndex
CREATE INDEX "Note_ownerId_deletedAt_draftUpdatedAt_idx" ON "notes"."Note"("ownerId", "deletedAt", "draftUpdatedAt" DESC);

-- CreateIndex
CREATE INDEX "Note_folderId_idx" ON "notes"."Note"("folderId");

-- CreateIndex
CREATE INDEX "Note_visibility_publishedAt_idx" ON "notes"."Note"("visibility", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Card_noteId_position_id_idx" ON "notes"."Card"("noteId", "position", "id");

-- CreateIndex
CREATE INDEX "NoteVersion_noteId_kind_createdAt_idx" ON "notes"."NoteVersion"("noteId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoteVersion_noteId_number_key" ON "notes"."NoteVersion"("noteId", "number");

-- CreateIndex
CREATE INDEX "NoteShare_userId_idx" ON "notes"."NoteShare"("userId");

-- CreateIndex
CREATE INDEX "NoteTag_tagId_idx" ON "notes"."NoteTag"("tagId");

-- CreateIndex
CREATE INDEX "NoteTopic_topicId_idx" ON "notes"."NoteTopic"("topicId");

-- AddForeignKey
ALTER TABLE "notes"."Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "notes"."Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "notes"."Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "notes"."Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."Note" ADD CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "notes"."Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."Note" ADD CONSTRAINT "Note_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "notes"."NoteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."Card" ADD CONSTRAINT "Card_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteVersion" ADD CONSTRAINT "NoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteShare" ADD CONSTRAINT "NoteShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteTag" ADD CONSTRAINT "NoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteTag" ADD CONSTRAINT "NoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "notes"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteTopic" ADD CONSTRAINT "NoteTopic_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteTopic" ADD CONSTRAINT "NoteTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "notes"."Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

