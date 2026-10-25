-- Age-blocked sign-ups stay recoverable, and admins can block, suspend, or permanently delete an account.

-- CreateEnum
CREATE TYPE "users"."AccountStatus" AS ENUM ('ACTIVE', 'AGE_BLOCKED', 'BLOCKED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "users"."User" ADD COLUMN "accountStatus" "users"."AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "statusReason" TEXT;

-- CreateIndex
CREATE INDEX "User_accountStatus_createdAt_idx" ON "users"."User"("accountStatus", "createdAt" DESC);

-- CreateTable
CREATE TABLE "users"."account_tombstones" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emailHash" TEXT NOT NULL,
    "adminId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_tombstones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_tombstones_emailHash_idx" ON "users"."account_tombstones"("emailHash");
