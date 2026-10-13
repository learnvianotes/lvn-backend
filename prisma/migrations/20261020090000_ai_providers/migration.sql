-- AI providers platform admins choose (ADR-0065): connections with encrypted keys, the default connections, and
-- each task's route pointing at a connection. Existing routes keep their model and answer through the default.

ALTER TYPE "ai"."AiProvider" ADD VALUE 'OPENAI';
ALTER TYPE "ai"."AiProvider" ADD VALUE 'ANTHROPIC';
ALTER TYPE "ai"."AiProvider" ADD VALUE 'GEMINI';
ALTER TYPE "ai"."AiProvider" ADD VALUE 'OPENAI_COMPATIBLE';

-- AlterTable
ALTER TABLE "ai"."AiModelRoute" DROP COLUMN "provider",
ADD COLUMN     "connectionId" UUID;

-- AlterTable
ALTER TABLE "ai"."AiUsage" ADD COLUMN     "connectionId" UUID;

-- CreateTable
CREATE TABLE "ai"."AiConnection" (
    "id" UUID NOT NULL,
    "kind" "ai"."AiProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyCipher" TEXT,
    "apiKeyHint" TEXT,
    "mayReceivePrivate" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chatModel" TEXT,
    "embedModel" TEXT,
    "inputMicroUsdPerMTok" INTEGER NOT NULL DEFAULT 0,
    "outputMicroUsdPerMTok" INTEGER NOT NULL DEFAULT 0,
    "embedMicroUsdPerMTok" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."AiSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "chatConnectionId" UUID,
    "embedConnectionId" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai"."AiSettings" ADD CONSTRAINT "AiSettings_chatConnectionId_fkey" FOREIGN KEY ("chatConnectionId") REFERENCES "ai"."AiConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AiSettings" ADD CONSTRAINT "AiSettings_embedConnectionId_fkey" FOREIGN KEY ("embedConnectionId") REFERENCES "ai"."AiConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."AiModelRoute" ADD CONSTRAINT "AiModelRoute_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ai"."AiConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One row of settings.
ALTER TABLE "ai"."AiSettings" ADD CONSTRAINT "AiSettings_one_row" CHECK ("id" = 1);
