#!/usr/bin/env node
/**
 * Retired. Study notes are Markdown pages in content/study. Deploy syncs them with
 * scripts/migrate-and-sync.mjs after `prisma migrate deploy`. That sync is idempotent and
 * does not use a migration for the notes.
 *
 * This script used to delete and rewrite prisma/migrations directories whose names contained
 * `study_notes`. It must never do that again: a migration Prisma has already applied cannot
 * be wiped or regenerated. It does not read or write any file.
 */
console.error('generate-study-seed.mjs is retired. Edit the Markdown pages in content/study. scripts/migrate-and-sync.mjs loads them on deploy. This script does not touch migrations.')
process.exit(1)
