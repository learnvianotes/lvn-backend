-- Beta access allowlist (contracts 0.69.0). Additive: a new table, plus one row per account that
-- already exists so admin, demo and smoke-test users keep access when an admin turns the switch on.
-- The switch itself is AdminSetting access_allowlist_enabled (no row, so it stays off).
-- Safe to re-run the seed: an email already listed is left as it is.

-- CreateTable
CREATE TABLE "users"."AccessAllowlistEntry" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "users"."GlobalRole" NOT NULL,
    "note" TEXT,
    "addedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessAllowlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessAllowlistEntry_email_key" ON "users"."AccessAllowlistEntry"("email");

-- CreateIndex
CREATE INDEX "AccessAllowlistEntry_role_idx" ON "users"."AccessAllowlistEntry"("role");

-- Seed existing accounts at their current global role. Deleted accounts are skipped: their address was rewritten.
INSERT INTO "users"."AccessAllowlistEntry" ("id", "email", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), lower(u."email"::text)::citext, u."globalRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"."User" u
WHERE u."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "users"."AccessAllowlistEntry" e WHERE e."email" = u."email"
  );
