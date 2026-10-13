-- Learning history (P6b, ADR-0067): the old site's study days, kept apart from what was recorded since so a claim can be
-- imported again or declined without touching the rest.

-- AlterTable
ALTER TABLE "core"."LearningDay" ADD COLUMN     "legacyLearningSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "legacyReadingSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "core"."LearningDayTopic" ADD COLUMN     "legacySeconds" INTEGER NOT NULL DEFAULT 0;

