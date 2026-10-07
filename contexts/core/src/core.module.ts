import { Module } from '@nestjs/common'

/**
 * The `core` bounded context (spec §6.1) — Postgres schema `core`.
 * Owns: groups, classrooms, quizzes, flashcards, exams, learning events, streaks, recommendations, resources, achievements, moderation, reports.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 */
@Module({})
export class CoreModule {}
