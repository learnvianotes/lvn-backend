-- Unlisted notes and quizzes, fork counts, note pages, and page-image uploads.
-- Additive and safe to run again: new enum values, columns and tables are created only when missing.

ALTER TYPE "notes"."Visibility" ADD VALUE IF NOT EXISTS 'UNLISTED';
ALTER TYPE "notes"."FilePurpose" ADD VALUE IF NOT EXISTS 'PAGE_IMAGE';

ALTER TABLE "notes"."Note" ADD COLUMN IF NOT EXISTS "forkCount" INTEGER NOT NULL DEFAULT 0;

-- Recount forks. A second run writes the same numbers.
UPDATE "notes"."Note" AS n
SET "forkCount" = c.cnt
FROM (
  SELECT "forkedFromNoteId" AS id, COUNT(*)::int AS cnt
  FROM "notes"."Note"
  WHERE "forkedFromNoteId" IS NOT NULL
  GROUP BY "forkedFromNoteId"
) AS c
WHERE n.id = c.id AND n."forkCount" IS DISTINCT FROM c.cnt;

CREATE TABLE IF NOT EXISTS "notes"."NotePage" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "drawing" JSONB NOT NULL DEFAULT '{"strokes":[]}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "NotePage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "notes"."NotePage" ADD CONSTRAINT "NotePage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "NotePage_noteId_index_idx" ON "notes"."NotePage"("noteId", "index");

CREATE TABLE IF NOT EXISTS "notes"."NotePageImage" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "NotePageImage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "notes"."NotePageImage" ADD CONSTRAINT "NotePageImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "notes"."NotePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "notes"."NotePageImage" ADD CONSTRAINT "NotePageImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "notes"."FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "NotePageImage_pageId_idx" ON "notes"."NotePageImage"("pageId");
CREATE INDEX IF NOT EXISTS "NotePageImage_fileId_idx" ON "notes"."NotePageImage"("fileId");

DO $$ BEGIN
  CREATE TYPE "core"."QuizVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "core"."SharedQuiz" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" "core"."QuizVisibility" NOT NULL DEFAULT 'PRIVATE',
    "linkToken" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedQuiz_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SharedQuiz_linkToken_key" ON "core"."SharedQuiz"("linkToken");
CREATE INDEX IF NOT EXISTS "SharedQuiz_ownerId_deletedAt_updatedAt_idx" ON "core"."SharedQuiz"("ownerId", "deletedAt", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "core"."SharedQuizQuestion" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    CONSTRAINT "SharedQuizQuestion_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "core"."SharedQuizQuestion" ADD CONSTRAINT "SharedQuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "core"."SharedQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SharedQuizQuestion_quizId_position_key" ON "core"."SharedQuizQuestion"("quizId", "position");

CREATE TABLE IF NOT EXISTS "core"."SharedQuizAttempt" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientOpId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedQuizAttempt_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "core"."SharedQuizAttempt" ADD CONSTRAINT "SharedQuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "core"."SharedQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SharedQuizAttempt_clientOpId_key" ON "core"."SharedQuizAttempt"("clientOpId");
CREATE INDEX IF NOT EXISTS "SharedQuizAttempt_quizId_userId_submittedAt_idx" ON "core"."SharedQuizAttempt"("quizId", "userId", "submittedAt");
CREATE INDEX IF NOT EXISTS "SharedQuizAttempt_userId_idx" ON "core"."SharedQuizAttempt"("userId");

CREATE TABLE IF NOT EXISTS "core"."SharedQuizAnswer" (
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "choiceIds" TEXT[] NOT NULL,
    "correct" BOOLEAN NOT NULL,
    CONSTRAINT "SharedQuizAnswer_pkey" PRIMARY KEY ("attemptId", "questionId")
);

DO $$ BEGIN
  ALTER TABLE "core"."SharedQuizAnswer" ADD CONSTRAINT "SharedQuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "core"."SharedQuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "core"."SharedQuizAnswer" ADD CONSTRAINT "SharedQuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "core"."SharedQuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
