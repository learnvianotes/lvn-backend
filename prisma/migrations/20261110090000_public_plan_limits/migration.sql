-- Plans people can see (contracts 0.70.0). Two new limit keys, and the FREE rows that keep
-- today's effective caps: one export a day and five imports a day, for every role.
-- NOTES_OWNED and AI_REQUESTS_DAILY stay unlimited on FREE (no row): nothing capped them before.
-- Safe to re-run: new enum values are ignored when present, and a row is inserted only when that
-- plan, key and role do not already have one.

ALTER TYPE "users"."LimitKey" ADD VALUE IF NOT EXISTS 'NOTES_OWNED';
ALTER TYPE "users"."LimitKey" ADD VALUE IF NOT EXISTS 'AI_REQUESTS_DAILY';

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000107', '01920000-0000-7000-8000-000000000001', 'EXPORTS_DAILY', 1, 'STUDENT'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'EXPORTS_DAILY' AND "appliesToRole" = 'STUDENT'
);

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000108', '01920000-0000-7000-8000-000000000001', 'EXPORTS_DAILY', 1, 'TEACHER'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'EXPORTS_DAILY' AND "appliesToRole" = 'TEACHER'
);

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000109', '01920000-0000-7000-8000-000000000001', 'EXPORTS_DAILY', 1, 'PLATFORM_ADMIN'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'EXPORTS_DAILY' AND "appliesToRole" = 'PLATFORM_ADMIN'
);

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000110', '01920000-0000-7000-8000-000000000001', 'IMPORTS_DAILY', 5, 'STUDENT'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'IMPORTS_DAILY' AND "appliesToRole" = 'STUDENT'
);

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000111', '01920000-0000-7000-8000-000000000001', 'IMPORTS_DAILY', 5, 'TEACHER'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'IMPORTS_DAILY' AND "appliesToRole" = 'TEACHER'
);

INSERT INTO "users"."Entitlement" ("id", "planId", "key", "limit", "appliesToRole")
SELECT '01920000-0000-7000-8000-000000000112', '01920000-0000-7000-8000-000000000001', 'IMPORTS_DAILY', 5, 'PLATFORM_ADMIN'
WHERE NOT EXISTS (
  SELECT 1 FROM "users"."Entitlement"
  WHERE "planId" = '01920000-0000-7000-8000-000000000001' AND "key" = 'IMPORTS_DAILY' AND "appliesToRole" = 'PLATFORM_ADMIN'
);
