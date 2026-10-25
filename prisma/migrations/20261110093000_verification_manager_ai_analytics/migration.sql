-- Manager role, ID-card check columns, analytics opt-out, and our own error and usage logs.

-- AlterEnum
ALTER TYPE "users"."GlobalRole" ADD VALUE 'MANAGER';

-- CreateEnum
CREATE TYPE "users"."IdCardVerdict" AS ENUM ('MATCH', 'MISMATCH', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "users"."ClientPlatform" AS ENUM ('WEB', 'MOBILE', 'BACKEND');

-- AlterTable
ALTER TABLE "users"."User" ADD COLUMN "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users"."VerificationRequest" ADD COLUMN "aiVerdict" "users"."IdCardVerdict",
ADD COLUMN "aiConfidence" DOUBLE PRECISION,
ADD COLUMN "aiReason" TEXT,
ADD COLUMN "aiExtracted" JSONB,
ADD COLUMN "aiCheckedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "users"."error_events" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "route" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "release" TEXT,
    "platform" "users"."ClientPlatform" NOT NULL,

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users"."usage_events" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "platform" "users"."ClientPlatform" NOT NULL,
    "appVersion" TEXT,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_events_code_occurredAt_idx" ON "users"."error_events"("code", "occurredAt");

-- CreateIndex
CREATE INDEX "error_events_occurredAt_idx" ON "users"."error_events"("occurredAt");

-- CreateIndex
CREATE INDEX "error_events_userId_occurredAt_idx" ON "users"."error_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "usage_events_name_occurredAt_idx" ON "users"."usage_events"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "usage_events_userId_occurredAt_idx" ON "users"."usage_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "usage_events_occurredAt_idx" ON "users"."usage_events"("occurredAt");
