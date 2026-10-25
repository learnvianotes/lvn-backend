-- The remote scan used its attempts (ADR-0102). FAILED is not served.
ALTER TYPE "notes"."ScanResult" ADD VALUE IF NOT EXISTS 'FAILED';
