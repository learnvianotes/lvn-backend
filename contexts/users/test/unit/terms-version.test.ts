import { Logger } from '@nestjs/common'
import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AppSettingsService } from '../../src/application/app-settings.service'
import { ConsentService } from '../../src/application/consent.service'
import { PlatformSettingsStore } from '../../src/application/platform-settings.store'
import { TermsVersionProvider } from '../../src/application/terms-version.provider'
import { DEFAULT_PUBLISHED_TERMS_VERSIONS, DEFAULT_TERMS_VERSION } from '../../src/domain/rules'
import { parseSettingInput, settingDef } from '../../src/domain/setting-catalog'
import { isTermsVersion, kAnonymous, parsePublishedTermsVersions, resolveTerms, termsChangeError } from '../../src/domain/terms'

/** ADR-0103: the terms version an admin manages. */

const none = { savedVersion: null, savedPublished: null, envVersion: undefined, envPublished: undefined }

describe('resolveTerms', () => {
  it('uses the saved setting, then the environment, then the built-in default', () => {
    expect(resolveTerms(none)).toEqual({ version: DEFAULT_TERMS_VERSION, source: 'DEFAULT', published: [...DEFAULT_PUBLISHED_TERMS_VERSIONS], publishedSource: 'DEFAULT' })
    expect(resolveTerms({ ...none, envVersion: '2026-10-08' })).toMatchObject({ version: '2026-10-08', source: 'ENV' })
    expect(resolveTerms({ ...none, envVersion: '2026-10-08', savedVersion: '2026-11-03' })).toMatchObject({ version: '2026-11-03', source: 'SETTING' })
    expect(resolveTerms({ ...none, envPublished: '2026-11-03' })).toMatchObject({ published: ['2026-11-03'], publishedSource: 'ENV' })
    expect(resolveTerms({ ...none, envPublished: '2026-11-03', savedPublished: '2026-12-01,2026-11-03' })).toMatchObject({ published: ['2026-11-03', '2026-12-01'], publishedSource: 'SETTING' })
  })

  it('skips a saved value that does not parse, so a bad row cannot block sign-up', () => {
    expect(resolveTerms({ ...none, savedVersion: '2026-02-30', envVersion: '2026-10-08' })).toMatchObject({ version: '2026-10-08', source: 'ENV' })
    expect(resolveTerms({ ...none, savedVersion: 'latest' })).toMatchObject({ version: DEFAULT_TERMS_VERSION, source: 'DEFAULT' })
    expect(resolveTerms({ ...none, savedPublished: '' })).toMatchObject({ publishedSource: 'DEFAULT' })
  })
})

describe('terms settings input', () => {
  it('takes a real date for terms_version', () => {
    const def = settingDef('terms_version')!
    expect(def).toMatchObject({ type: 'STRING', category: 'legal', environmentFallback: true, defaultValue: DEFAULT_TERMS_VERSION })
    expect(parseSettingInput(def, ' 2026-10-08 ')).toEqual({ ok: true, value: '2026-10-08' })
    expect(parseSettingInput(def, '2026-02-30').ok).toBe(false)
    expect(parseSettingInput(def, '03-11-2026').ok).toBe(false)
    expect(isTermsVersion('2024-02-29')).toBe(true)
    expect(isTermsVersion('2026-13-01')).toBe(false)
  })

  it('normalises the published list and refuses anything that is not a date', () => {
    const def = settingDef('terms_published_versions')!
    expect(def.defaultValue).toBe('2026-10-08,2026-11-03,2026-11-12,2026-11-25')
    expect(parseSettingInput(def, ' 2026-11-03, 2026-10-08,2026-11-03 ,')).toEqual({ ok: true, value: '2026-10-08,2026-11-03' })
    expect(parseSettingInput(def, '').ok).toBe(false)
    expect(parseSettingInput(def, '2026-10-08,soon').ok).toBe(false)
    expect(parsePublishedTermsVersions('2026-10-08;2026-11-03').ok).toBe(false)
    expect(parseSettingInput(def, Array.from({ length: 100 }, () => '2026-10-08').join(',')).ok).toBe(false)
  })

  it('explains why a version outside the published list is refused', () => {
    const published = ['2026-10-08', '2026-11-03']
    expect(termsChangeError('terms_version', { version: '2026-11-03', source: 'SETTING', published, publishedSource: 'DEFAULT' })).toBeNull()
    expect(termsChangeError('terms_version', { version: '2026-12-01', source: 'SETTING', published, publishedSource: 'DEFAULT' })).toMatch(/2026-12-01 is not a published terms version\. Choose one of: 2026-10-08, 2026-11-03/)
    expect(termsChangeError('terms_published_versions', { version: '2026-11-03', source: 'DEFAULT', published: ['2026-10-08'], publishedSource: 'SETTING' })).toMatch(/must include the terms version in effect \(2026-11-03\)/)
  })

  it('hides a count below five', () => {
    expect([0, 1, 4, 5, 12].map(kAnonymous)).toEqual([null, null, null, 5, 12])
  })
})

type Row = { key: string; enabled: boolean; value: unknown; updatedBy: string | null; updatedAt: Date }

/** The AppSetting table, as the store, the provider and the settings service use it. */
function fakeDb(rows = new Map<string, Row>()) {
  return {
    rows,
    appSetting: {
      findMany: async (args?: { where?: { key?: { in: string[] } } }) => [...rows.values()].filter((r) => !args?.where?.key || args.where.key.in.includes(r.key)),
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({ where, create, update }: { where: { key: string }; create: Omit<Row, 'updatedAt'>; update: Partial<Row> }) => {
        const row = { ...(rows.get(where.key) ?? create), ...update, key: where.key, updatedAt: new Date() } as Row
        rows.set(where.key, row)
        return row
      },
      deleteMany: async ({ where }: { where: { key: string } }) => ({ count: rows.delete(where.key) ? 1 : 0 }),
    },
  }
}

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (e: AppError) => e,
  )
}

function harness(env: { terms_version?: string; terms_published_versions?: string } = {}) {
  const db = fakeDb()
  const config = { settingFallbacks: { terms_version: env.terms_version, terms_published_versions: env.terms_published_versions } }
  const store = new PlatformSettingsStore(db as never, config as never)
  const terms = new TermsVersionProvider(db as never, store, config as never)
  const audits: { action: string; metadata?: Record<string, unknown> }[] = []
  const settings = new AppSettingsService(
    db as never,
    store,
    { actor: async () => ({ globalRole: 'PLATFORM_ADMIN' }) } as never,
    { record: async (entry: { action: string; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never,
    config as never,
    terms,
  )
  return { db, config, store, terms, settings, audits }
}

describe('TermsVersionProvider with the settings service', () => {
  it('follows a save and a reset in this process at once, without waiting for a reload', async () => {
    const h = harness({ terms_version: '2026-10-08' })
    expect(h.terms.current()).toBe('2026-10-08')
    expect(h.terms.resolve().source).toBe('ENV')

    await h.settings.update('admin', 'terms_version', '2026-11-03')
    expect(h.terms.current()).toBe('2026-11-03')
    expect(h.terms.resolve().source).toBe('SETTING')
    expect(h.audits.at(-1)).toEqual({ actorId: 'admin', action: 'settings.updated', targetType: 'AppSetting', metadata: { key: 'terms_version', value: '2026-11-03', previous: '2026-10-08' } })

    const reset = await h.settings.reset('admin', 'terms_version')
    expect(reset).toMatchObject({ value: '2026-10-08', overridden: false })
    expect(h.terms.current()).toBe('2026-10-08')
    expect(h.audits.at(-1)).toMatchObject({ action: 'settings.reset', metadata: { key: 'terms_version', previous: '2026-11-03', value: '2026-10-08' } })
  })

  it('warns at start-up when TERMS_VERSION alone is not on the built-in published list', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      harness({ terms_version: '2026-12-01' }).terms.onModuleInit()
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TERMS_VERSION 2026-12-01 is not a published terms version/))
      warn.mockClear()
      harness({ terms_version: '2026-10-08' }).terms.onModuleInit()
      harness().terms.onModuleInit()
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('lets another process see the change on its next reload', async () => {
    const h = harness()
    const otherStore = new PlatformSettingsStore(h.db as never, h.config as never)
    const other = new TermsVersionProvider(h.db as never, otherStore, h.config as never)
    await otherStore.reload()
    await h.settings.update('admin', 'terms_version', '2026-10-08')
    expect(other.current()).toBe(DEFAULT_TERMS_VERSION)
    await otherStore.reload()
    expect(other.current()).toBe('2026-10-08')
  })

  it('refuses a version the web has not published, and a list without the version in effect', async () => {
    const h = harness()
    const unpublished = await rejection(() => h.settings.update('admin', 'terms_version', '2026-12-01'))
    expect(unpublished).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'value'] })
    expect(unpublished.message).toMatch(/not a published terms version/)
    expect(h.db.rows.has('terms_version')).toBe(false)
    expect(h.audits).toEqual([])

    const dropped = await rejection(() => h.settings.update('admin', 'terms_published_versions', '2026-10-08'))
    expect(dropped).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'value'] })
    expect(dropped.message).toMatch(/must include the terms version in effect \(2026-11-12\)/)

    // Publish first, then switch. The list has to keep the version in effect.
    await h.settings.update('admin', 'terms_published_versions', '2026-12-01, 2026-11-12,2026-11-03,2026-10-08')
    expect(h.terms.resolve().published).toEqual(['2026-10-08', '2026-11-03', '2026-11-12', '2026-12-01'])
    await h.settings.update('admin', 'terms_version', '2026-12-01')
    expect(h.terms.current()).toBe('2026-12-01')

    // Resetting the list would bring back the default list, which lacks 2026-12-01.
    expect(await rejection(() => h.settings.reset('admin', 'terms_published_versions'))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['key'] })
    expect(h.db.rows.has('terms_published_versions')).toBe(true)
    await h.settings.reset('admin', 'terms_version')
    await h.settings.reset('admin', 'terms_published_versions')
    expect(h.terms.resolve()).toMatchObject({ version: DEFAULT_TERMS_VERSION, source: 'DEFAULT', publishedSource: 'DEFAULT' })
  })

  it('checks the saved rows, not a stale cache, before a change', async () => {
    const h = harness()
    // Another process published 2026-12-01; this process has not reloaded yet.
    h.db.rows.set('terms_published_versions', { key: 'terms_published_versions', enabled: false, value: { v: '2026-11-03,2026-12-01' }, updatedBy: 'other', updatedAt: new Date() })
    await h.settings.update('admin', 'terms_version', '2026-12-01')
    expect(h.terms.current()).toBe('2026-12-01')
  })

  it('makes acceptTerms and termsAccepted follow the version in effect', async () => {
    const h = harness()
    const records: { userId: string; kind: string; version: string; acceptedAt: Date }[] = [{ userId: 'u', kind: 'TERMS', version: DEFAULT_TERMS_VERSION, acceptedAt: new Date(1) }]
    const consentDb = {
      consentRecord: {
        findFirst: async () => records.filter((r) => r.kind === 'TERMS').sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime())[0] ?? null,
        createMany: async ({ data }: { data: { userId: string; kind: string; version: string }[] }) => void records.push(...data.map((d, i) => ({ ...d, acceptedAt: new Date(10 + i) }))),
      },
    }
    const consent = new ConsentService(consentDb as never, h.terms)
    expect(await consent.accepted('u')).toBe(true)
    await h.settings.update('admin', 'terms_version', '2026-10-08')
    expect(await consent.accepted('u')).toBe(false)
    expect(await rejection(() => consent.accept('u', DEFAULT_TERMS_VERSION))).toMatchObject({ code: ErrorCode.VALIDATION, field: ['input', 'version'] })
    await consent.accept('u', '2026-10-08')
    expect(await consent.accepted('u')).toBe(true)
  })
})
