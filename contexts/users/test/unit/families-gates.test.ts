import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { UsersService } from '../../src/application/users.service'
import { familiesStandingFrom, safetyReminderRequired, under13DevicesClosed, under13SocialClosed } from '../../src/domain/families-standing'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

interface Row {
  id: string
  deletedAt: Date | null
  dateOfBirth: Date | null
  declaredAge: number | null
  ageDeclaredAt: Date | null
  safetyReminderAcknowledgedAt: Date | null
  consents: { kind: string }[]
  guardianConsents: { method: string; verifiedAt: Date | null; ageBand: string; socialEnabled: boolean }[]
}

function service(row: Row, mode = 'block') {
  const db = {
    user: {
      findFirst: async () => (row.deletedAt ? null : row),
      findMany: async () => (row.deletedAt ? [] : [row]),
      update: async ({ data }: { data: Partial<Row> }) => Object.assign(row, data),
    },
  }
  const settings = { verificationSettings: () => ({ emailPlusEnabled: true }), string: () => mode, consentAge: () => 18 }
  return new UsersService(db as never, {} as never, settings as never)
}

const base = (): Row => ({
  id: 'child',
  deletedAt: null,
  dateOfBirth: null,
  declaredAge: 10,
  ageDeclaredAt: new Date('2026-01-01T00:00:00Z'),
  safetyReminderAcknowledgedAt: null,
  consents: [],
  guardianConsents: [{ method: 'auto_unverified', verifiedAt: null, ageBand: 'under_13', socialEnabled: false }],
})

describe('under-13 device and social gates', () => {
  it('refuses push and capture until consent is verified, then allows them', async () => {
    const closed = service(base())
    expect((await rejection(() => closed.assertDevicesOpen('child'))).code).toBe(ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR)
    expect((await rejection(() => closed.assertCaptureAllowed('child', 'VOICE_NOTE', 'audio/webm'))).code).toBe(ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR)
    await expect(closed.assertCaptureAllowed('child', 'ATTACHMENT', 'image/jpeg')).resolves.toBeUndefined()

    const row = base()
    row.guardianConsents[0] = { method: 'email_plus', verifiedAt: new Date(), ageBand: 'under_13', socialEnabled: false }
    const open = service(row)
    await expect(open.assertDevicesOpen('child')).resolves.toBeUndefined()
    await expect(open.assertCaptureAllowed('child', 'ATTACHMENT', 'video/mp4')).resolves.toBeUndefined()
  })

  it('keeps social off until consent is verified and the parent turns it on', async () => {
    const unverified = service(base())
    expect((await rejection(() => unverified.assertSocialOpen('child'))).code).toBe(ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR)

    const verifiedOff = base()
    verifiedOff.guardianConsents[0] = { method: 'email_plus', verifiedAt: new Date(), ageBand: 'under_13', socialEnabled: false }
    expect((await rejection(() => service(verifiedOff).assertSocialOpen('child'))).code).toBe(ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR)

    const verifiedOn = base()
    verifiedOn.guardianConsents[0] = { method: 'email_plus', verifiedAt: new Date(), ageBand: 'under_13', socialEnabled: true }
    await expect(service(verifiedOn).assertSocialOpen('child')).resolves.toBeUndefined()
    expect(await service(verifiedOn).socialClosedIds(['child', 'child'])).toEqual([])
    expect(await service(verifiedOff).socialClosedIds(['child'])).toEqual(['child'])
  })

  it('does not put a 13–17 account through the under-13 social gate', async () => {
    const teen = base()
    teen.declaredAge = 15
    teen.guardianConsents[0] = { method: 'auto_unverified', verifiedAt: null, ageBand: '13_15', socialEnabled: false }
    await expect(service(teen).assertSocialOpen('child')).resolves.toBeUndefined()
    await expect(service(teen).assertDevicesOpen('child')).resolves.toBeUndefined()
  })
})

describe('minor PII filter', () => {
  const text = 'Write me at ada@school.edu or 9876543210'

  it('blocks, redacts, or leaves a minor’s text according to the admin mode', async () => {
    expect((await rejection(() => service(base(), 'block').filterMinorText('child', text))).code).toBe(ErrorCode.MINOR_PII_BLOCKED)
    expect(await service(base(), 'redact').filterMinorText('child', text)).toBe('Write me at [removed] or [removed]')
    expect(await service(base(), 'off').filterMinorText('child', text)).toBe(text)
    const adult = base()
    adult.declaredAge = 20
    adult.guardianConsents = []
    expect(await service(adult, 'block').filterMinorText('child', text)).toBe(text)
  })
})

describe('safety reminder', () => {
  it('is required for a minor until they acknowledge it, and never for an adult', async () => {
    const row = base()
    const users = service(row)
    expect(safetyReminderRequired((await users.familiesStanding('child'))!)).toBe(true)
    await users.acknowledgeSafetyReminder('child')
    expect(row.safetyReminderAcknowledgedAt).toBeInstanceOf(Date)
    expect(safetyReminderRequired((await users.familiesStanding('child'))!)).toBe(false)

    const adult = base()
    adult.declaredAge = 19
    adult.guardianConsents = []
    expect(safetyReminderRequired((await service(adult).familiesStanding('child'))!)).toBe(false)
  })

  it('treats an unknown age as a minor and a known age under 13 as under-13', () => {
    const unknown = familiesStandingFrom({ facts: { dateOfBirth: null, declaredAge: null, ageDeclaredAt: null }, ageBand: null, methods: [], socialEnabled: false, safetyReminderAcknowledgedAt: null })
    expect(unknown.minor).toBe(true)
    expect(unknown.under13).toBe(false)
    expect(under13DevicesClosed(unknown)).toBe(false)
    expect(safetyReminderRequired(unknown)).toBe(true)
    const young = familiesStandingFrom({
      facts: { dateOfBirth: null, declaredAge: 9, ageDeclaredAt: new Date('2026-01-01T00:00:00Z') },
      ageBand: null,
      methods: ['email_plus'],
      socialEnabled: true,
      safetyReminderAcknowledgedAt: null,
    })
    expect(young.under13).toBe(true)
    expect(under13SocialClosed(young)).toBe(false)
  })
})
