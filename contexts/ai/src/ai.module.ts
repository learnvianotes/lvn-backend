import { Module } from '@nestjs/common'

/**
 * The `ai` bounded context (spec §6.1) — Postgres schema `ai`.
 * Owns: AiGateway, providers, usage and quotas, NoteChunk embeddings, RAG, public-note pipeline, transcription, moderation scoring.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 */
@Module({})
export class AiModule {}
