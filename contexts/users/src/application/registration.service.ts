import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { dateOfBirthSchema, displayNameSchema, isBelowMinimumAge, TERMS_VERSION, UNDER_MINIMUM_AGE_MESSAGE } from '../domain/rules'
import { AccountDeletionService } from './account-deletion.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { InstitutionalEmailService } from './institutional-email.service'
import { parseField } from './input'

export interface RegistrationDetails {
  displayName: string
  dateOfBirth: string
  institutionalEmail?: string | null
  acceptedTermsVersion: string
}

/**
 * The registration details of ADR-0017 for accounts created by a sign-in provider, which skip signUp: name, date
 * of birth, accepted Terms, and optionally a college email. Given once; the account is limited until then. A date of
 * birth below the minimum age (ADR-0091) erases the unfinished account at once: it was made by the person's own sign-in
 * moments ago, holds nothing yet, and the clients ask "Is this right?" before sending the answer.
 */
@Injectable()
export class RegistrationService {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
    private readonly deletion: AccountDeletionService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly settings: PlatformSettingsStore,
  ) {}

  async complete(userId: string, input: RegistrationDetails): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { registrationCompletedAt: true } })
    if (user.registrationCompletedAt) throw Errors.conflict('Your registration is already complete.')
    const displayName = parseField(displayNameSchema, input.displayName, 'displayName')
    const dateOfBirth = parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth')
    if (isBelowMinimumAge(dateOfBirth, this.settings.minimumAge())) {
      await this.deletion.eraseRefused(userId)
      throw Errors.underMinimumAge(UNDER_MINIMUM_AGE_MESSAGE, ['input', 'dateOfBirth'])
    }
    if (input.acceptedTermsVersion !== TERMS_VERSION) {
      throw Errors.validation('Accept the current Terms and Privacy Policy to continue.', ['input', 'acceptedTermsVersion'])
    }
    if (input.institutionalEmail) await this.institutional.check(input.institutionalEmail, ['input', 'institutionalEmail'])

    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { displayName, dateOfBirth, registrationCompletedAt: new Date() } }),
      this.db.consentRecord.createMany({
        data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId, kind, version: TERMS_VERSION })),
      }),
    ])
    // A name and a date of birth: people search may now find them, once past the consent age (ADR-0055).
    await this.events.publish('PersonChanged', { userId })
    if (input.institutionalEmail) await this.institutional.start(userId, input.institutionalEmail)
  }
}
