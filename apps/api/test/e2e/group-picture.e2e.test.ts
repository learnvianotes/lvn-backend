import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * A group's picture (ADR-0076): an admin uploads a picture of their own and sets it; anyone who sees the group sees it;
 * a member who is not an admin, someone else's file or a file for something else is refused; replacing or removing it
 * deletes the old file.
 */
describe('group picture', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; token: string }
  const person = async (): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true })
    return { id: u.id, token: tokenFor(t.config, u.id) }
  }
  const gql = <T>(query: string, variables: object, who: Person) => t.gql<T>(query, variables as Record<string, unknown>, who.token)
  const update = async (who: Person, input: object) => {
    const res = await gql<{ updateGroup: { group: { pictureUrl: string | null } | null; userErrors: { message: string }[] } }>('mutation ($input: UpdateGroupInput!) { updateGroup(input: $input) { group { pictureUrl } userErrors { message } } }', { input }, who)
    return { picture: res.data?.updateGroup.group?.pictureUrl ?? null, error: res.errors?.[0]?.message ?? res.data?.updateGroup.userErrors[0]?.message }
  }
  const pictureOf = async (id: string, who: Person) => (await gql<{ group: { pictureUrl: string | null } | null }>('query ($id: UUID!) { group(id: $id) { pictureUrl } }', { id }, who)).data!.group!.pictureUrl
  const picture = (who: Person, purpose = 'GROUP_PICTURE') => upload(t, who.token, purpose, 'image/png', SAMPLES.png, 'picture.png')

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
  })
  afterAll(() => t?.close())

  it('an admin sets, replaces and removes it; members who are not admins cannot; everyone who sees the group sees it', async () => {
    const owner = await person()
    const member = await person()
    const outsider = await person()
    const groupId = (await gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input: { name: 'Graph theory circle', privacy: 'PUBLIC', joinPolicy: 'OPEN' } }, owner)).data!.createGroup.group.id
    await gql('mutation ($input: GroupIdInput!) { joinGroup(input: $input) { group { id } } }', { input: { groupId } }, member)
    expect(await pictureOf(groupId, outsider)).toBeNull()

    const first = await picture(owner)
    const set = await update(owner, { groupId, pictureFileId: first })
    expect(set.error).toBeUndefined()
    expect(set.picture).toMatch(/^http/)
    expect(await db.fileObject.findUnique({ where: { id: first } })).toMatchObject({ purpose: 'GROUP_PICTURE', parentType: 'GROUP', parentId: groupId })
    expect(await pictureOf(groupId, outsider)).toMatch(/^http/)

    // Not an admin; someone else's file; a file uploaded for something else.
    expect((await update(member, { groupId, pictureFileId: await picture(member) })).error).toBe('Only the group’s admins change its settings.')
    expect((await update(owner, { groupId, pictureFileId: await picture(member) })).error).toBeTruthy()
    expect((await update(owner, { groupId, pictureFileId: await picture(owner, 'COVER') })).error).toBeTruthy()
    expect((await db.group.findUniqueOrThrow({ where: { id: groupId } })).pictureFileId).toBe(first)

    // Replaced: the old file goes; removed: none, and its file goes too.
    const second = await picture(owner)
    expect((await update(owner, { groupId, pictureFileId: second })).picture).toMatch(/^http/)
    expect((await db.fileObject.findUnique({ where: { id: first } }))?.status).toBe('DELETED')
    expect((await update(owner, { groupId, name: 'Graph theory club' })).picture).toMatch(/^http/)
    expect((await update(owner, { groupId, removePicture: true })).picture).toBeNull()
    expect((await db.fileObject.findUnique({ where: { id: second } }))?.status).toBe('DELETED')
  })
})
