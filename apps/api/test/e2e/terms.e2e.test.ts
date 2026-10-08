import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** §15.2: the Terms, Privacy Policy and content licence are accepted with their version, and again when it changes. */
describe('accepting the terms again', () => {
  let t: TestApp
  let db: PrismaService

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
  })

  afterAll(() => t.close())

  const accepted = async (token: string) => (await t.gql<{ viewer: { termsAccepted: boolean | null } }>('{ viewer { termsAccepted } }', {}, token)).data!.viewer.termsAccepted
  const accept = async (token: string, version: string) =>
    (await t.gql<{ acceptTerms: { ok: boolean; userErrors: { field: string[] | null; code: string }[] } }>('mutation ($input: AcceptTermsInput!) { acceptTerms(input: $input) { ok userErrors { field code } } }', { input: { version } }, token)).data!.acceptTerms

  it('asks again after a new version, and records all three documents with it', async () => {
    const user = await seedUser(t.app)
    const token = tokenFor(t.config, user.id)
    const { termsVersion } = (await t.gql<{ termsVersion: string }>('{ termsVersion }')).data!
    // Accepted an older version at sign-up.
    await db.consentRecord.createMany({ data: (['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const).map((kind, i) => ({ id: `01920000-0000-7000-8000-0000000000a${i}`, userId: user.id, kind, version: '2020-01-01' })) })
    expect(await accepted(token)).toBe(false)

    expect((await accept(token, '2020-01-01')).userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'version'] })
    expect((await accept(token, termsVersion)).ok).toBe(true)
    expect(await accepted(token)).toBe(true)
    const records = await db.consentRecord.findMany({ where: { userId: user.id, version: termsVersion } })
    expect(records.map((r) => r.kind).sort()).toEqual(['PRIVACY', 'PUBLIC_CONTENT_LICENCE', 'TERMS'])
    // Accepting twice changes nothing.
    await accept(token, termsVersion)
    expect(await db.consentRecord.count({ where: { userId: user.id, version: termsVersion } })).toBe(3)
  })

  it('is the viewer’s own business', async () => {
    const a = await seedUser(t.app)
    const b = await seedUser(t.app)
    // Another person is reachable through a note of theirs anyone may read.
    const noteId = newId()
    const versionId = newId()
    await db.note.create({ data: { id: noteId, ownerId: a.id, visibility: 'PUBLIC', title: 'Public' } })
    await db.noteVersion.create({ data: { id: versionId, noteId, number: 1, kind: 'PUBLISHED', title: 'Public', cards: [], createdById: a.id } })
    await db.note.update({ where: { id: noteId }, data: { publishedVersionId: versionId, publishedAt: new Date() } })
    const res = await t.gql<{ note: { owner: { id: string; termsAccepted: boolean | null } } }>('query ($id: UUID!) { note(id: $id) { owner { id termsAccepted } } }', { id: noteId }, tokenFor(t.config, b.id))
    expect(res.data!.note.owner).toEqual({ id: a.id, termsAccepted: null })
  })
})
