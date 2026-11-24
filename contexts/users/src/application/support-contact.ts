import { Inject, Injectable } from '@nestjs/common'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

/**
 * The single address on `AGE_RESTRICTED` and on a blocked sign-in.
 * Always `SUPPORT_EMAIL` (support@learnvianotes.in unless the environment sets another). A platform admin's own
 * inbox is not shown to people.
 */
@Injectable()
export class SupportContact {
  constructor(@Inject(USERS_CONFIG) private readonly config: UsersConfig) {}

  email(): Promise<string> {
    return Promise.resolve(this.config.supportEmail)
  }
}
