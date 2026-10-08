-- Phase 2 (P2c): fork credit on notes (spec §4.4, ADR-0010).

-- CreateEnum
CREATE TYPE "notes"."ForkRole" AS ENUM ('OWNER', 'EDITOR', 'READER');

-- AlterTable
ALTER TABLE "notes"."Note" ADD COLUMN     "forkedAsRole" "notes"."ForkRole",
ADD COLUMN     "forkedFromNoteId" UUID,
ADD COLUMN     "forkedFromOwnerId" UUID,
ADD COLUMN     "forkedFromVersionId" UUID,
ADD COLUMN     "forkedFromVisibility" "notes"."Visibility";

-- CreateIndex
CREATE INDEX "Note_forkedFromNoteId_idx" ON "notes"."Note"("forkedFromNoteId");

