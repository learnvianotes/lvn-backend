
-- CreateTable
CREATE TABLE "notes"."NoteChunk" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "cardIds" UUID[],
    "text" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AiAnswer" (
    "id" UUID NOT NULL,
    "askerId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "noteId" UUID,
    "groupId" UUID,
    "doubtId" UUID,
    "status" "ai"."AiArtifactStatus" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteChunk_versionId_idx" ON "notes"."NoteChunk"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteChunk_noteId_position_key" ON "notes"."NoteChunk"("noteId", "position");

-- CreateIndex
CREATE INDEX "AiAnswer_askerId_createdAt_idx" ON "ai"."AiAnswer"("askerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiAnswer_askerId_noteId_idx" ON "ai"."AiAnswer"("askerId", "noteId");

-- CreateIndex
CREATE INDEX "AiAnswer_askerId_doubtId_idx" ON "ai"."AiAnswer"("askerId", "doubtId");

-- AddForeignKey
ALTER TABLE "notes"."NoteChunk" ADD CONSTRAINT "NoteChunk_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes"."NoteChunk" ADD CONSTRAINT "NoteChunk_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "notes"."NoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nearest chunks by cosine distance (ADR-0060). Prisma has no HNSW type: the schema names this index without its method.
CREATE INDEX "NoteChunk_embedding_idx" ON "notes"."NoteChunk" USING hnsw ("embedding" vector_cosine_ops);
