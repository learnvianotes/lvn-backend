-- Learning events (§14.1, ADR-0067). The events themselves live in their own schema, "learning", which Prisma does
-- not manage (it cannot declare a partitioned table): an append-only table partitioned by month on the server's time,
-- the ids seen lately (so a batch sent twice is stored once), and a function the worker calls nightly to make the
-- coming months' partitions. The core context reads and writes them with SQL. What history and Rhythm read are the
-- daily rollups below, ordinary Prisma tables in "core".

CREATE SCHEMA IF NOT EXISTS "learning";

CREATE TABLE "learning"."LearningEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "topicKeys" TEXT[] NOT NULL DEFAULT '{}',
    "durationMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "clientTs" TIMESTAMPTZ(3) NOT NULL,
    "serverTs" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "platform" TEXT NOT NULL,
    -- CLIENT (trackEvents) or SERVER (recorded from what the server knows)
    "source" TEXT NOT NULL
) PARTITION BY RANGE ("serverTs");

CREATE INDEX "LearningEvent_userId_serverTs_idx" ON "learning"."LearningEvent" ("userId", "serverTs");
CREATE INDEX "LearningEvent_userId_type_clientTs_idx" ON "learning"."LearningEvent" ("userId", "type", "clientTs");

-- Anything outside the monthly partitions lands here, so an insert never fails; partitions are made ahead to keep it
-- empty (a new partition cannot be attached over rows the default already holds).
CREATE TABLE "learning"."LearningEvent_default" PARTITION OF "learning"."LearningEvent" DEFAULT;

-- The event ids seen in the last 30 days. A unique key on the partitioned table would have to include "serverTs", which
-- differs between a batch and its retry.
CREATE TABLE "learning"."LearningEventKey" (
    "id" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEventKey_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningEventKey_receivedAt_idx" ON "learning"."LearningEventKey" ("receivedAt");

-- The partitions from this month (UTC) to `ahead` months on, each named LearningEvent_YYYY_MM; returns how many it made.
CREATE FUNCTION "learning"."ensure_partitions"("ahead" INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  "first" DATE := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  "month" DATE;
  "name" TEXT;
  "made" INTEGER := 0;
BEGIN
  FOR i IN 0.."ahead" LOOP
    "month" := ("first" + make_interval(months => i))::date;
    "name" := format('LearningEvent_%s', to_char("month", 'YYYY_MM'));
    IF to_regclass(format('"learning".%I', "name")) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE "learning".%I PARTITION OF "learning"."LearningEvent" FOR VALUES FROM (%L) TO (%L)',
        "name", "month"::timestamp AT TIME ZONE 'UTC', ("month" + interval '1 month')::timestamp AT TIME ZONE 'UTC'
      );
      "made" := "made" + 1;
    END IF;
  END LOOP;
  RETURN "made";
END
$$;

SELECT "learning"."ensure_partitions"(3);

-- CreateTable
CREATE TABLE "core"."LearnerSettings" (
    "userId" UUID NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LearnerSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "core"."LearningDay" (
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "learningSeconds" INTEGER NOT NULL DEFAULT 0,
    "readingSeconds" INTEGER NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "quizAnswers" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LearningDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "core"."LearningDayTopic" (
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "topicKey" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearningDayTopic_pkey" PRIMARY KEY ("userId","day","topicKey")
);

-- CreateIndex
CREATE INDEX "LearningDayTopic_userId_topicKey_idx" ON "core"."LearningDayTopic"("userId", "topicKey");

