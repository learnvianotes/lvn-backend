import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { dateOfBirthSchema, displayNameSchema, TERMS_VERSION } from '../domain/rules'
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
 * of birth, accepted Terms, and optionally a college email. Given once; the account is limited until then.
 */
@Injectable()
export class RegistrationService {
  constructor(
    private readonly db: PrismaService,
    private readonly institutional: InstitutionalEmailService,
  ) {}

  async complete(userId: string, input: RegistrationDetails): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { registrationCompletedAt: true } })
    if (user.registrationCompletedAt) throw Errors.conflict('Your registration is already complete.')
    const displayName = parseField(displayNameSchema, input.displayName, 'displayName')
    const dateOfBirth = parseField(dateOfBirthSchema, input.dateOfBirth, 'dateOfBirth')
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
    if (input.institutionalEmail) await this.institutional.start(userId, input.institutionalEmail)
  }
}
