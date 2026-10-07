import { Module } from '@nestjs/common'

/**
 * The `notes` bounded context (spec §6.1) — Postgres schema `notes`.
 * Owns: subjects, topics, folders, tags, notes, cards, versions, shares, forks, FileObject, search indexing, SearchProvider (Postgres → Typesense).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 */
@Module({})
export class NotesModule {}
