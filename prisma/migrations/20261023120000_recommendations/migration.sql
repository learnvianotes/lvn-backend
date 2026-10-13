-- Recommendations and their dismissals (P6f, ADR-0071).

-- CreateEnum
CREATE TYPE "core"."RecommendationKind" AS ENUM ('EXAM_TOPIC', 'REVISE_TOPIC', 'CONTINUE_NOTE', 'QUIZ_ON_TOPIC', 'POPULAR_NOTE');

-- CreateTable
CREATE TABLE "core"."Recommendation" (
    "userId" UUID NOT NULL,
    "kind" "core"."RecommendationKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("userId","kind","entityId")
);

-- CreateTable
CREATE TABLE "core"."RecommendationDismissal" (
    "userId" UUID NOT NULL,
    "kind" "core"."RecommendationKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "until" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecommendationDismissal_pkey" PRIMARY KEY ("userId","kind","entityId")
);

-- CreateIndex
CREATE INDEX "Recommendation_userId_score_idx" ON "core"."Recommendation"("userId", "score" DESC);

