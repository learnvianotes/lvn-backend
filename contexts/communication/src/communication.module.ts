import { Module } from '@nestjs/common'

/**
 * The `communication` bounded context (spec §6.1) — Postgres schema `comms`.
 * Owns: notifications, preferences, push (FCM), email, digests, WebSocket fan-out for subscriptions.
 * Imported only by the composition roots (apps/api, apps/worker); other contexts reach it through its
 * facade interface in libs/, never by importing this package (enforced by dependency-cruiser).
 */
@Module({})
export class CommunicationModule {}
