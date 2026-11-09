import { Inject, Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { ageRestrictedError } from '../domain/account-status'
import { displayNameSchema, isBelowMinimumAge } from '../domain/rules'
import { readDeclaredAge } from './age'
import { AgeBlockService } from './age-block.service'
import { PlatformSettingsStore } from './platform-settings.store'
import { SupportContact } from './support-contact'
import { InstitutionalEmailService } from './institutional-email.service'
import { parseField } from './input'
import { TermsVersionProvider } from './terms-version.provider'
import { WelcomeEmailService } from './welcome-email.service'

export interface RegistrationDetails {
  displayName: string
  /** Whole years, 1–120 (ADR-0104). */
  age?: number | null
  /** Deprecated (ADR-0104): apps from before it send this instead of `age`. Ignored when `age` is sent. */
  dateOfBirth?: string | null
  institutionalEmail?: string | null
  acceptedTermsVersion: string
}

/**
 * The registration details of ADR-0017 for accounts created by a sign-in provider, which skip signUp: name, age
 * (ADR-0104), accepted Terms, and optionally a college email. Given once; the account is limited until then. An age
 * below the minimum keeps the account as AGE_BLOCKED and ends the session from the provider sign-in, so an admin can
 * correct the age later.
 */
@Injectable()
export class RegistrationService {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
    private readonly ageBlock: AgeBlockService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly settings: PlatformSettingsStore,
    private readonly support: SupportContact,
    private readonly terms: TermsVersionProvider,
    private readonly welcome: WelcomeEmailService,
  ) {}

  async complete(userId: string, input: RegistrationDetails): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { registrationCompletedAt: true } })
    if (user.registrationCompletedAt) throw Errors.conflict('Your registration is already complete.')
    const displayName = parseField(displayNameSchema, input.displayName, 'displayName')
    // ADR-0104: the age typed in whole years, or the age today from an older app's date of birth. No date is stored.
    const declared = readDeclaredAge(input)
    // ADR-0103: the version in effect now. The consent rows record this same value.
    const termsVersion = this.terms.current()
    if (input.acceptedTermsVersion !== termsVersion) {
      throw Errors.validation('Accept the current Terms and Privacy Policy to continue.', ['input', 'acceptedTermsVersion'])
    }
    if (input.institutionalEmail) await this.institutional.check(input.institutionalEmail, ['input', 'institutionalEmail'])
    if (isBelowMinimumAge(declared.value.declaredAge, this.settings.minimumAge())) {
      await this.ageBlock.holdRegistration(userId, displayName, declared.value, termsVersion)
      throw ageRestrictedError(await this.support.email(), ['input', declared.field])
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          displayName,
          ...declared.value,
          registrationCompletedAt: new Date(),
          // Under the consent age the account is a restricted minor (ADR-0108): no usage analytics.
          analyticsOptOut: declared.value.declaredAge < this.settings.consentAge(),
        },
      }),
      this.db.consentRecord.createMany({
        data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind) => ({ id: newId(), userId, kind, version: termsVersion })),
      }),
    ])
    // After the profile is stored. A mail or Redis failure here does not undo it, and does not fail registration.
    await this.welcome.schedule(userId)
    // A name and an age: people search may now find them, once past the consent age (ADR-0055).
    await this.events.publish('PersonChanged', { userId })
    if (input.institutionalEmail) await this.institutional.start(userId, input.institutionalEmail)
  }
}
