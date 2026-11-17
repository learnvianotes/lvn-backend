import { AudienceService } from '../../src/audience/audience.service'
import { ResendAudienceClient, type ResendContactsApi } from '../../src/audience/resend-contacts'
import { unsubscribeToken } from '../../src/email/unsubscribe'
import { SettingsResolver } from '../../src/graphql/settings.resolver'
import { PreferencesService } from '../../src/preferences/preferences.service'

const SECRET = 'x'.repeat(32)
const USER = '01920000-0000-7000-8000-0000000000a1'

function harness() {
  const updates: { email: string; unsubscribed?: boolean }[] = []
  const api: ResendContactsApi = {
    create: async () => ({ data: { id: 'c' }, error: null }),
    update: async (input) => {
      updates.push(input)
      return { data: { id: 'c' }, error: null }
    },
    remove: async () => ({ data: { deleted: true }, error: null }),
  }
  let row: { productEmails?: boolean; weeklyDigest?: boolean } | null = null
  const db = {
    notificationSettings: {
      findUnique: async () => row,
      upsert: async ({ create, update }: { create: typeof row; update: typeof row }) => {
        row = { ...(row ?? create), ...update }
        return row
      },
    },
    notificationPreference: { findMany: async () => [], findUnique: async () => null, upsert: async () => ({}) },
    user: { findUnique: async () => ({ email: 'asha@college.edu', deletedAt: null }) },
  }
  const preferences = new PreferencesService(db as never)
  const audience = new AudienceService({} as never, db as never, new ResendAudienceClient('aud-1', api))
  const resolver = new SettingsResolver(preferences, { count: async () => 0 } as never, { enabled: false } as never, { hmacSecret: SECRET } as never, audience)
  return { resolver, updates, row: () => row }
}

describe('product email settings', () => {
  it('stores productEmails and sets the contact unsubscribed flag', async () => {
    const { resolver, updates, row } = harness()
    const off = await resolver.updateNotificationSettings({ productEmails: false }, { userId: USER } as never)
    expect(off.settings?.productEmails).toBe(false)
    expect(row()?.productEmails).toBe(false)
    expect(updates).toEqual([{ audienceId: 'aud-1', email: 'asha@college.edu', unsubscribed: true }])

    const on = await resolver.updateNotificationSettings({ productEmails: true }, { userId: USER } as never)
    expect(on.settings?.productEmails).toBe(true)
    expect(updates[1]).toMatchObject({ unsubscribed: false })
  })

  it('honours a MARKETING unsubscribe link', async () => {
    const { resolver, updates, row } = harness()
    const token = unsubscribeToken(SECRET, USER, 'MARKETING')
    const result = await resolver.unsubscribeEmail({ token })
    expect(result).toEqual({ kind: 'MARKETING', userErrors: [] })
    expect(row()?.productEmails).toBe(false)
    expect(updates[0]).toMatchObject({ unsubscribed: true })
  })
})
