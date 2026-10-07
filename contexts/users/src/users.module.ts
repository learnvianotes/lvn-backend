import { Module } from '@nestjs/common'

/**
 * The `users` bounded context (spec §6.1) — Postgres schema `users`.
 * Owns: auth, sessions, users, profiles, roles, PolicyService, device tokens, organizations (read model from the admin app).
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 */
@Module({})
export class UsersModule {}
