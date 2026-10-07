import { Module } from '@nestjs/common'
import { CONTEXT_MODULES } from './contexts'

/** Composition root for background jobs (spec §3 apps/worker). BullMQ processors arrive in Phase 1. */
@Module({ imports: CONTEXT_MODULES })
export class WorkerModule {}
