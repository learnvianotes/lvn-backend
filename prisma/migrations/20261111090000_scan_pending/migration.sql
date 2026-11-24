-- Remote scanning (ADR-0102). PENDING means the file is waiting for the scan service.
-- A file in this state is never served. PostgreSQL 16 allows ADD VALUE inside a
-- transaction when the new value is not used in the same migration.
ALTER TYPE "notes"."ScanResult" ADD VALUE IF NOT EXISTS 'PENDING';

CREATE INDEX IF NOT EXISTS "FileObject_scanResult_status_idx" ON "notes"."FileObject" ("scanResult", "status");
