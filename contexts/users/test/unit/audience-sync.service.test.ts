import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AudienceSyncService, splitDisplayName } from '../../src/application/audience-sync.service'
import { STUDY_PUBLISHER_EMAIL, STUDY_PUBLISHER_ID } from '../../src/domain/study-publisher'

const USER = '01920000-0000-7000-8000-0000000000a1'

interface Stored {
  id: string
  email: string
  displayName: string
  deletedAt: Date | null
  accountStatus: string
  registrationCompletedAt: Date | null
  audienceSyncedAt: Date | null
}

function stored(over: Partial<Stored> = {}): Stored {
  return {
    id: USER,
    email: 'asha@college.edu',
    displayName: 'Asha Rao',
    deletedAt: null,
    accountStatus: 'ACTIVE',
    registrationCompletedAt: new Date('2026-11-01T00:00:00Z'),
    audienceSyncedAt: null,
    ...over,
  }
}

function harness(initial: Stored = stored(), options: { enabled?: boolean; fail?: boolean; productEmails?: boolean; queueDown?: boolean } = {}) {
  let row = { ...initial }
  const calls: unknown[][] = []
  const queued: { name: string; data: unknown }[] = []
  const audience = {
    enabled: options.enabled ?? true,
    upsert: async (contact: unknown) => {
      calls.push(['upsert', contact])
      if (options.fail) throw new Error('Resend audience create failed: internal_server_error (500)')
    },
    remove: async (email: string) => {
      calls.push(['remove', email])
    },
    setUnsubscribed: async () => undefined,
  }
  const db = {
    user: {
      findUnique: async () => row,
      updateMany: async ({ where, data }: { where: { audienceSyncedAt?: Date | null }; data: { audienceSyncedAt: Date } }) => {
        if (where.audienceSyncedAt === null && row.audienceSyncedAt) return { count: 0 }
        row = { ...row, ...data }
        return { count: 1 }
      },
      update: async ({ data }: { data: Partial<Stored> }) => {
        row = { ...row, ...data }
        return row
      },
    },
    notificationSettings: { findUnique: async () => (options.productEmails === undefined ? null : { productEmails: options.productEmails }) },
  }
  const service = new AudienceSyncService(db as never, { queue: () => ({ add: async (name: string, data: unknown) => { if (options.queueDown) throw new Error('redis down'); queued.push({ name, data }) } }) } as never, audience as never)
  return { service, calls, queued, row: () => row }
}

describe('splitDisplayName', () => {
  it('uses the first word as the given name', () => {
    expect(splitDisplayName('Asha Rao')).toEqual({ firstName: 'Asha', lastName: 'Rao' })
    expect(splitDisplayName('Asha')).toEqual({ firstName: 'Asha', lastName: '' })
    expect(splitDisplayName('  Asha  Devi Rao ')).toEqual({ firstName: 'Asha', lastName: 'Devi Rao' })
  })
})

describe('AudienceSyncService', () => {
  it('upserts an active registered account and records audienceSyncedAt', async () => {
    const { service, calls, row } = harness()
    await expect(service.sync(USER)).resolves.toBe('synced')
    expect(calls).toEqual([['upsert', { email: 'asha@college.edu', firstName: 'Asha', lastName: 'Rao', unsubscribed: false }]])
    expect(row().audienceSyncedAt).toBeInstanceOf(Date)
  })

  it('does not call Resend again once the account is synced', async () => {
    const { service, calls } = harness(stored({ audienceSyncedAt: new Date('2026-11-02T00:00:00Z') }))
    await expect(service.sync(USER)).resolves.toBe('skipped')
    expect(calls).toEqual([])
  })

  it('skips the study publisher, a deleted account, a blocked account and an unfinished registration', async () => {
    const publisher = harness(stored({ id: STUDY_PUBLISHER_ID, email: STUDY_PUBLISHER_EMAIL }))
    const deleted = harness(stored({ deletedAt: new Date() }))
    const blocked = harness(stored({ accountStatus: 'BLOCKED' }))
    const unfinished = harness(stored({ registrationCompletedAt: null }))
    await expect(publisher.service.sync(STUDY_PUBLISHER_ID)).resolves.toBe('skipped')
    await expect(deleted.service.sync(USER)).resolves.toBe('skipped')
    await expect(blocked.service.sync(USER)).resolves.toBe('skipped')
    await expect(unfinished.service.sync(USER)).resolves.toBe('skipped')
    expect(publisher.calls).toEqual([])
    expect(deleted.calls).toEqual([])
    expect(blocked.calls).toEqual([])
    expect(unfinished.calls).toEqual([])
  })

  it('leaves the marker unset when the audience is off or the upsert fails', async () => {
    const off = harness(stored(), { enabled: false })
    await expect(off.service.sync(USER)).resolves.toBe('skipped')
    expect(off.row().audienceSyncedAt).toBeNull()
    const failed = harness(stored(), { fail: true })
    await expect(failed.service.sync(USER)).rejects.toThrow(/Resend/)
    expect(failed.row().audienceSyncedAt).toBeNull()
  })

  it('sends unsubscribed when product emails are off', async () => {
    const { service, calls } = harness(stored(), { productEmails: false })
    await service.sync(USER)
    expect(calls[0]?.[1]).toMatchObject({ unsubscribed: true })
  })

  it('removes the contact on deletion', async () => {
    const { service, calls } = harness()
    await expect(service.removeContact('asha@college.edu')).resolves.toBe('removed')
    expect(calls).toEqual([['remove', 'asha@college.edu']])
    await expect(service.scheduleRemoval('asha@college.edu')).resolves.toBeUndefined()
    await expect(service.scheduleRemoval('deleted-1@deleted.learnvianotes.invalid')).resolves.toBeUndefined()
  })

  it('removes the old address and upserts the new one', async () => {
    const { service, calls, row } = harness()
    row().email = 'asha.rao@college.edu'
    await expect(service.emailChanged(USER, 'asha@college.edu')).resolves.toBe('updated')
    expect(calls[0]).toEqual(['remove', 'asha@college.edu'])
    expect(calls[1]?.[1]).toMatchObject({ email: 'asha.rao@college.edu', unsubscribed: false })
    expect(row().audienceSyncedAt).toBeInstanceOf(Date)
  })

  it('still finishes scheduling when the queue is down', async () => {
    const { service } = harness(stored(), { queueDown: true })
    await expect(service.schedule(USER)).resolves.toBeUndefined()
  })
})

describe('audience backfill script', () => {
  it('prints counts and returns before any Resend call when --dry-run, and never sends email', () => {
    const src = readFileSync(path.join(__dirname, '../../../../scripts/audience-backfill.mjs'), 'utf8')
    expect(src).not.toMatch(/\/emails/)
    expect(src.indexOf('if (dryRun) return')).toBeLessThan(src.indexOf('await fetch('))
  })
})
