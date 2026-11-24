import type { TypesenseSchema } from '../infrastructure/typesense'

/**
 * PostgreSQL's English stop words (`tsearch_data/english.stop`), kept in Typesense as a stop-word set so the two
 * providers drop the same words from a query (ADR-0055).
 */
export const ENGLISH_STOPWORDS = (
  'i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers herself it ' +
  'its itself they them their theirs themselves what which who whom this that these those am is are was were be been ' +
  'being have has had having do does did doing a an the and but if or because as until while of at by for with about ' +
  'against between into through during before after above below to from up down in out on off over under again further ' +
  'then once here there when where why how all any both each few more most other some such no nor not only own same so ' +
  'than too very s t can will just don should now'
).split(' ')

export const STOPWORDS_SET = 'english'

export type SearchEntityName = 'NOTE' | 'USER' | 'TOPIC' | 'GROUP' | 'CLASSROOM' | 'RESOURCE'

/** One Typesense collection: `<prefix><name>_v<version>` behind the alias `<prefix><name>` (ADR-0055). */
export interface CollectionDef {
  name: string
  entity: SearchEntityName
  /** Bump with any change to `fields`: the worker builds the new version beside the old and moves the alias */
  version: number
  fields: TypesenseSchema['fields']
  defaultSortingField?: string
}

const text = (name: string) => ({ name, type: 'string' as const, stem: true })
const keyword = (name: string) => ({ name, type: 'string' as const, facet: true })
const keywords = (name: string) => ({ name, type: 'string[]' as const, facet: true })

export const COLLECTIONS: Record<SearchEntityName, CollectionDef> = {
  /** Published notes outside the trash: words to match, and every field of the read predicate (§5). */
  NOTE: {
    name: 'notes',
    entity: 'NOTE',
    version: 1,
    fields: [
      text('title'),
      { name: 'topics', type: 'string[]', stem: true },
      text('body'),
      /** The body's first words, shown when only the title or topics matched; stored, not searched */
      { name: 'lead', type: 'string', index: false, optional: true },
      keyword('kind'),
      keyword('visibility'),
      keyword('moderation'),
      keyword('ownerId'),
      keywords('sharedUserIds'),
      keywords('groupIds'),
      keywords('classroomIds'),
      keywords('topicIds'),
      keywords('subjectIds'),
      { name: 'publishedAt', type: 'int64' },
    ],
    defaultSortingField: 'publishedAt',
  },
  /** Accounts with a known age (ADR-0104); who may be found is decided per request (age, blocks). */
  USER: {
    name: 'users',
    entity: 'USER',
    version: 1,
    fields: [
      { name: 'handle', type: 'string' },
      { name: 'displayName', type: 'string' },
      { name: 'headline', type: 'string', optional: true, stem: true },
      { name: 'bio', type: 'string', optional: true, stem: true },
      { name: 'adultFromDays', type: 'int32' },
      keyword('globalRole'),
    ],
  },
  TOPIC: {
    name: 'topics',
    entity: 'TOPIC',
    version: 1,
    fields: [text('title'), text('subject'), keyword('subjectId'), keyword('origin'), { name: 'proposedById', type: 'string', facet: true, optional: true }],
  },
  /** Groups and project workspaces (ADR-0056): PUBLIC ones for everyone, PRIVATE ones for their members. */
  GROUP: {
    name: 'groups',
    entity: 'GROUP',
    version: 1,
    fields: [text('name'), { name: 'description', type: 'string', stem: true, optional: true }, keyword('type'), keyword('privacy'), { name: 'memberCount', type: 'int32' }],
    defaultSortingField: 'memberCount',
  },
  /** Classes, for their members only (§11). */
  CLASSROOM: {
    name: 'classrooms',
    entity: 'CLASSROOM',
    version: 1,
    fields: [text('name'), { name: 'description', type: 'string', stem: true, optional: true }, { name: 'memberCount', type: 'int32' }],
    defaultSortingField: 'memberCount',
  },
  /** Approved resources (ADR-0075), for everyone; ranked by saves. */
  RESOURCE: {
    name: 'resources',
    entity: 'RESOURCE',
    version: 1,
    fields: [
      text('title'),
      { name: 'author', type: 'string', optional: true },
      { name: 'description', type: 'string', stem: true, optional: true },
      { name: 'topics', type: 'string[]', stem: true },
      keyword('type'),
      keyword('submittedById'),
      { name: 'saveCount', type: 'int32' },
    ],
    defaultSortingField: 'saveCount',
  },
}

export const aliasName = (prefix: string, def: CollectionDef) => `${prefix}${def.name}`
export const versionName = (prefix: string, def: CollectionDef, version = def.version) => `${prefix}${def.name}_v${version}`

/** The versions of a collection among existing collection names, oldest first. */
export const versionsOf = (prefix: string, def: CollectionDef, names: string[]) =>
  names
    .map((n) => new RegExp(`^${prefix}${def.name}_v(\\d+)$`).exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ name: m[0], version: Number(m[1]) }))
    .sort((a, b) => a.version - b.version)

export const schemaOf = (prefix: string, def: CollectionDef): TypesenseSchema => ({
  name: versionName(prefix, def),
  fields: def.fields,
  ...(def.defaultSortingField ? { default_sorting_field: def.defaultSortingField } : {}),
})
