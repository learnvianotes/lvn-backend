import { MailService } from '@lvn-backend/communication'
import { ENTITLEMENTS, FacadesModule, FILES, MAILER, POLICY } from '@lvn-backend/facades'
import { FilesService } from '@lvn-backend/notes'
import { EntitlementService, PolicyService } from '@lvn-backend/users'

/** Which context implements each facade in this process (§6.1). */
export const facades = () =>
  FacadesModule.bind([
    [MAILER, MailService],
    [FILES, FilesService],
    [POLICY, PolicyService],
    [ENTITLEMENTS, EntitlementService],
  ])
