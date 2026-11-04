-- ADR-0104: registration asks for an age in whole years instead of a date of birth.
-- Additive and safe to run again: two nullable columns. "dateOfBirth" and every value in it are left as they are.

ALTER TABLE "users"."User" ADD COLUMN IF NOT EXISTS "declaredAge" INTEGER,
ADD COLUMN IF NOT EXISTS "ageDeclaredAt" TIMESTAMPTZ(3);
