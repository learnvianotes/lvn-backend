import { AiModule } from '@lvn-backend/ai'
import { CommunicationModule } from '@lvn-backend/communication'
import { CoreModule } from '@lvn-backend/core'
import { NotesModule } from '@lvn-backend/notes'
import { UsersModule } from '@lvn-backend/users'

/**
 * The five bounded contexts this process composes (spec §6). Extracting a context (§6.5 step 4) removes
 * it from this list and from apps/worker, and adds apps/<name>-service.
 */
export const CONTEXT_MODULES = [UsersModule, NotesModule, CoreModule, AiModule, CommunicationModule]
