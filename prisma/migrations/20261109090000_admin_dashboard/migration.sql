-- Admin settings values and plan prices (ADR-0101).
-- Additive only. Safe to re-run: the enum ignores duplicate_object, new columns use IF NOT EXISTS,
-- and the backfill only fills rows that have no value yet. No row is deleted and no existing column changes type.

DO $$ BEGIN
  CREATE TYPE "users"."PlanInterval" AS ENUM ('NONE', 'MONTH', 'YEAR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"."AppSetting" ADD COLUMN IF NOT EXISTS "value" JSONB;

-- Boolean rows written before this migration keep their meaning. A later admin edit replaces `value`.
UPDATE "users"."AppSetting"
SET "value" = jsonb_build_object('v', "enabled")
WHERE "value" IS NULL;

ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "priceMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "interval" "users"."PlanInterval" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users"."Plan" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
