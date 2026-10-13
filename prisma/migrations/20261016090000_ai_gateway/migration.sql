-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateEnum
CREATE TYPE "ai"."AiProvider" AS ENUM ('OLLAMA');

-- CreateTable
CREATE TABLE "ai"."AiModelRoute" (
    "task" TEXT NOT NULL,
    "provider" "ai"."AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputMicroUsdPerMTok" INTEGER NOT NULL DEFAULT 0,
    "outputMicroUsdPerMTok" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiModelRoute_pkey" PRIMARY KEY ("task")
);

-- CreateTable
CREATE TABLE "ai"."AiUsage" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "task" TEXT NOT NULL,
    "provider" "ai"."AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "promptId" TEXT,
    "promptVersion" INTEGER,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "ai"."AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "ai"."AiUsage"("createdAt");

