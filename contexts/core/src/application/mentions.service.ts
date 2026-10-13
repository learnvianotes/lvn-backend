import { Inject, Injectable } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { PEOPLE, type People } from '@lvn-backend/facades'

/** At most this many people are told about one comment or post (ADR-0054); the rest of the names stay plain text. */
export const MAX_MENTIONS = 10

/**
 * `@handle` at the start of the text or after anything but a letter, digit, `@` or `.`: handles are lowercase letters
 * and digits (users' handleBase), so an email address's `name@domain` is never read as a mention.
 */
const MENTION = /(?:^|[^A-Za-z0-9@.])@([A-Za-z0-9]{3,40})\b/g

/** The handles named in a text, lowercased, each once, in the order they first appear. */
export function handlesIn(text: string): string[] {
  const seen = new Set<string>()
  for (const m of text.matchAll(MENTION)) seen.add(m[1]!.toLowerCase())
  return [...seen]
}

export type MentionPlace = { kind: 'NOTE'; noteId: string } | { kind: 'GROUP'; groupId: string } | { kind: 'CLASSROOM'; classroomId: string } | { kind: 'RESOURCE'; resourceId: string }

/**
 * Mentions (ADR-0054): who a comment or a post names, told once each. A name is skipped when it is not a person, is
 * the author, was named before this edit, is already told otherwise (the reply's or the note's owner), cannot read
 * the comment or post, blocks or is blocked by the author, or restricts the author.
 */
@Injectable()
export class MentionsService {
  constructor(
    @Inject(PEOPLE) private readonly people: People,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async mention(input: {
    entityType: 'COMMENT' | 'GROUP_POST'
    entityId: string
    authorId: string
    text: string
    /** The text before an edit: only people named for the first time are told */
    before?: string | null
    place: MentionPlace
    /** People told about it some other way */
    alreadyTold?: string[]
    canSee: (userId: string) => Promise<boolean>
  }): Promise<string[]> {
    const earlier = new Set(input.before ? handlesIn(input.before) : [])
    const skip = new Set([input.authorId, ...(input.alreadyTold ?? [])])
    const told: string[] = []
    for (const handle of handlesIn(input.text)) {
      if (told.length >= MAX_MENTIONS) break
      if (earlier.has(handle)) continue
      const person = await this.people.find(handle)
      if (!person || skip.has(person.id) || told.includes(person.id)) continue
      if (await this.people.blockedBetween(input.authorId, person.id)) continue
      if (await this.people.restricts(person.id, input.authorId)) continue
      if (!(await input.canSee(person.id))) continue
      told.push(person.id)
    }
    if (told.length) await this.events.publish('PeopleMentioned', { entityType: input.entityType, entityId: input.entityId, authorId: input.authorId, mentionedIds: told, place: input.place })
    return told
  }
}
