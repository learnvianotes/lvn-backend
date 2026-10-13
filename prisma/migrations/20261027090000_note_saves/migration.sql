-- CreateTable
CREATE TABLE "notes"."NoteSave" (
    "noteId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteSave_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateIndex
CREATE INDEX "NoteSave_userId_createdAt_idx" ON "notes"."NoteSave"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notes"."NoteSave" ADD CONSTRAINT "NoteSave_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

