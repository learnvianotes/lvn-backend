-- Reports of AI answers (ADR-0111). The answer text is not stored.

CREATE TYPE "ai"."AiReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TYPE "ai"."AiReportReason" AS ENUM ('INACCURATE', 'INAPPROPRIATE', 'HARMFUL', 'PERSONAL_INFO', 'OTHER');

CREATE TABLE "ai"."AiReport" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "responseId" UUID NOT NULL,
    "responseKind" TEXT NOT NULL,
    "reason" "ai"."AiReportReason" NOT NULL,
    "comment" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" "ai"."AiReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiReport_status_createdAt_idx" ON "ai"."AiReport"("status", "createdAt" DESC);

CREATE INDEX "AiReport_reporterId_createdAt_idx" ON "ai"."AiReport"("reporterId", "createdAt" DESC);
