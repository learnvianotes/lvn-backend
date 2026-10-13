-- A version that every change to AI connections, defaults or routes raises, so every process (API instances, the
-- worker) reads them again on its next call instead of after a cache expires (ADR-0065).

-- AlterTable
ALTER TABLE "ai"."AiSettings" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
