-- Daily rollup of the admin usage metrics (ADR-0106).
-- Additive and safe on a live database: one new table, no change to an existing one, nothing rewritten or locked.
-- Safe to run again: the table is created only when missing.

CREATE TABLE IF NOT EXISTS "users"."daily_metrics" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "value" BIGINT NOT NULL,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("day", "metric", "dimension")
);
