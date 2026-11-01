import { GlobalRole, type Actor } from '@lvn/contracts/domain'
import { noteAccess, visibleNotesWhere, type NoteAccessRow } from '../../src/domain/note-access'
import { gatePublic, visibilityChoices } from '../../src/domain/visibility-choices'

const owner = (extra: Partial<Actor> = {}): Actor => ({ id: 'owner', globalRole: GlobalRole.STUDENT, institutionVerified: false, ...extra })

const row = (extra: Partial<NoteAccessRow> = {}): NoteAccessRow => ({
  id: 'note',
  ownerId: 'owner',
  visibility: 'PRIVATE',
  forkingEnabled: true,
  publishedVersionId: 'version',
  deletedAt: null,
  moderation: 'OK',
  ...extra,
})

describe('visibility choices', () => {
  it('lets an unverified owner set Private and Unlisted, and Public only when the gate says so', () => {
    const gated = gatePublic(owner(), true)
    const choices = visibilityChoices(gated, row(), true)
    expect(choices.map((choice) => [choice.visibility, choice.enabled])).toEqual([
      ['PRIVATE', true],
      ['UNLISTED', true],
      ['PUBLIC', false],
    ])
    expect(choices.find((choice) => choice.visibility === 'PUBLIC')!.reason).toMatch(/cannot make notes public/)
    const open = visibilityChoices(gatePublic(owner(), false), row(), true)
    expect(open.find((choice) => choice.visibility === 'PUBLIC')!.enabled).toBe(true)
    expect(visibilityChoices(owner({ mayPublishPublic: true }), row(), true).find((choice) => choice.visibility === 'PUBLIC')!.enabled).toBe(true)
  })

  it('asks for a published version before Unlisted or Public, and keeps Shared only while the note is Shared', () => {
    const actor = gatePublic(owner({ institutionVerified: true }), true)
    const unpublished = visibilityChoices(actor, row({ publishedVersionId: null }), false)
    expect(unpublished.find((choice) => choice.visibility === 'UNLISTED')).toMatchObject({ enabled: false, reason: expect.stringMatching(/Publish the note first/) })
    const shared = visibilityChoices(actor, row({ visibility: 'SHARED' }), true)
    expect(shared.map((choice) => choice.visibility)).toEqual(['PRIVATE', 'SHARED', 'UNLISTED', 'PUBLIC'])
  })

  it('opens an unlisted note by id and leaves it out of the anonymous list', () => {
    const note = row({ visibility: 'UNLISTED' })
    expect(noteAccess(null, note, null)).toBe('READER')
    expect(noteAccess(owner({ id: 'someone', institutionVerified: true }), note, null)).toBe('READER')
    const listed = JSON.stringify(visibleNotesWhere(null))
    expect(listed).toContain('PUBLIC')
    expect(listed).not.toContain('UNLISTED')
    expect(JSON.stringify(visibleNotesWhere('someone'))).toContain('UNLISTED')
  })
})
