-- Groups and classes in search (ADR-0056): what the outbox can name. PostgreSQL 12+ adds both values in one
-- transaction.
ALTER TYPE "notes"."SearchEntity" ADD VALUE 'GROUP';
ALTER TYPE "notes"."SearchEntity" ADD VALUE 'CLASSROOM';
