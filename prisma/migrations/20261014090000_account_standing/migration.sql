-- AlterTable
ALTER TABLE "core"."Group" ADD COLUMN     "removedReason" TEXT;

-- AlterTable
ALTER TABLE "users"."User" ADD COLUMN     "suspendedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "suspensionReason" TEXT;

