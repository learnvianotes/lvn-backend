import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AdminContentService } from '../../src/application/admin-content.service'

const ADMIN = 'admin-1'
const ASHA = 'asha'
const RAVI = 'ravi'
const at = (n: number) => new Date(n)

const users = [
  { id: ASHA, handle: 'asha', email: 'asha@college.edu' },
  { id: RAVI, handle: 'ravi', email: 'ravi@college.edu' },
]

const notes = [
  { id: 'n1', ownerId: ASHA, title: 'A'.repeat(250), visibility: 'PUBLIC', moderation: 'OK', deletedAt: null, createdAt: at(5000), updatedAt: at(5000) },
  { id: 'n2', ownerId: ASHA, title: 'Two', visibility: 'PUBLIC', moderation: 'OK', deletedAt: null, createdAt: at(4000), updatedAt: at(4000) },
  { id: 'n3', ownerId: ASHA, title: 'Three', visibility: 'PUBLIC', moderation: 'OK', deletedAt: null, createdAt: at(3000), updatedAt: at(3000) },
  { id: 'n4', ownerId: ASHA, title: 'Four', visibility: 'PUBLIC', moderation: 'OK', deletedAt: null, createdAt: at(2000), updatedAt: at(2000) },
  { id: 'n5', ownerId: ASHA, title: 'Five', visibility: 'PUBLIC', moderation: 'HIDDEN', deletedAt: null, createdAt: at(1000), updatedAt: at(1000) },
  { id: 'n-private', ownerId: ASHA, title: 'Secret', visibility: 'PRIVATE', moderation: 'OK', deletedAt: null, createdAt: at(4500), updatedAt: at(4500) },
  { id: 'n-shared', ownerId: RAVI, title: 'Shared', visibility: 'SHARED', moderation: 'OK', deletedAt: null, createdAt: at(3500), updatedAt: at(3500) },
]

const comments = [
  { id: 'c-public', authorId: ASHA, targetType: 'NOTE', targetId: 'n1', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello from a public note' }] }] }, moderation: 'OK', visibleTo: null, deletedAt: null, createdAt: at(4800), editedAt: null },
  { id: 'c-private', authorId: ASHA, targetType: 'NOTE', targetId: 'n-private', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'secret comment' }] }] }, moderation: 'OK', visibleTo: null, deletedAt: null, createdAt: at(4400), editedAt: null },
  { id: 'c-thread', authorId: ASHA, targetType: 'NOTE', targetId: 'n1', body: { type: 'doc', content: [] }, moderation: 'OK', visibleTo: RAVI, deletedAt: null, createdAt: at(4300), editedAt: null },
]

const groups = [
  { id: 'g-public', ownerId: ASHA, name: 'Physics', description: 'Open', privacy: 'PUBLIC', deletedAt: null, createdAt: at(4200), updatedAt: at(4200) },
  { id: 'g-private', ownerId: ASHA, name: 'Hidden group', description: null, privacy: 'PRIVATE', deletedAt: null, createdAt: at(4100), updatedAt: at(4100) },
]

function noteOf(id: string) {
  const note = notes.find((row) => row.id === id)!
  return { id: note.id, title: note.title, visibility: note.visibility, deletedAt: note.deletedAt }
}

const shares = [
  { noteId: 'n1', userId: RAVI, createdById: ASHA, createdAt: at(3300), note: noteOf('n1') },
  { noteId: 'n-private', userId: RAVI, createdById: ASHA, createdAt: at(3200), note: noteOf('n-private') },
]

const files = [
  { id: 'f-public', ownerId: ASHA, originalFileName: 'diagram.png', purpose: 'ATTACHMENT', parentType: 'NOTE', parentId: 'n1', visibilitySnapshot: null, deletedAt: null, createdAt: at(3900), updatedAt: at(3900) },
  { id: 'f-private', ownerId: ASHA, originalFileName: 'secret.png', purpose: 'ATTACHMENT', parentType: 'NOTE', parentId: 'n-private', visibilitySnapshot: null, deletedAt: null, createdAt: at(3800), updatedAt: at(3800) },
  { id: 'f-college', ownerId: ASHA, originalFileName: 'id-card.jpg', purpose: 'COLLEGE_ID', parentType: 'NOTE', parentId: 'n1', visibilitySnapshot: null, deletedAt: null, createdAt: at(3700), updatedAt: at(3700) },
  { id: 'f-verify', ownerId: ASHA, originalFileName: 'proof.pdf', purpose: 'ATTACHMENT', parentType: 'VERIFICATION_REQUEST', parentId: 'req-1', visibilitySnapshot: null, deletedAt: null, createdAt: at(3600), updatedAt: at(3600) },
  { id: 'f-snap', ownerId: ASHA, originalFileName: 'snap.png', purpose: 'ATTACHMENT', parentType: 'NOTE', parentId: 'n1', visibilitySnapshot: 'PRIVATE', deletedAt: null, createdAt: at(3550), updatedAt: at(3550) },
]

const highlights = [
  { id: 'h-public', noteId: 'n1', createdById: ASHA, quote: 'a public passage', comment: null, createdAt: at(3400), updatedAt: at(3400), attachment: { note: noteOf('n1') } },
  { id: 'h-private', noteId: 'n-private', createdById: ASHA, quote: 'a private passage', comment: null, createdAt: at(3100), updatedAt: at(3100), attachment: { note: noteOf('n-private') } },
]

const tables: Record<string, unknown[]> = {
  user: users,
  note: notes,
  comment: comments,
  group: groups,
  noteShare: shares,
  fileObject: files,
  noteHighlight: highlights,
  noteAttachment: [
    { fileId: 'f-public', noteId: 'n1', note: noteOf('n1') },
    { fileId: 'f-private', noteId: 'n-private', note: noteOf('n-private') },
  ],
}

function compare(left: unknown, right: unknown, op: (a: number | string, b: number | string) => boolean): boolean {
  const value = (item: unknown) => (item instanceof Date ? item.getTime() : typeof item === 'number' || typeof item === 'string' ? item : null)
  const a = value(left)
  const b = value(right)
  return a !== null && b !== null && typeof a === typeof b && op(a, b)
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

function match(row: unknown, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true
  if (!row || typeof row !== 'object') return false
  const spec = where as Record<string, unknown>
  if (Array.isArray(spec.AND) && !spec.AND.every((part) => match(row, part))) return false
  if (Array.isArray(spec.OR) && !spec.OR.some((part) => match(row, part))) return false
  if (spec.NOT && match(row, spec.NOT)) return false
  for (const [key, value] of Object.entries(spec)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') continue
    if (!matchField((row as Record<string, unknown>)[key], value)) return false
  }
  return true
}

function matchField(actual: unknown, value: unknown): boolean {
  if (value === null) return actual == null
  if (value instanceof Date || typeof value !== 'object') return same(actual, value)
  const spec = value as Record<string, unknown>
  if ('not' in spec && same(actual, spec.not)) return false
  if (Array.isArray(spec.notIn) && spec.notIn.includes(actual)) return false
  if (Array.isArray(spec.in) && !spec.in.includes(actual)) return false
  if (spec.gte != null && !compare(actual, spec.gte, (left, right) => left >= right)) return false
  if (spec.lte != null && !compare(actual, spec.lte, (left, right) => left <= right)) return false
  if (spec.lt != null && !compare(actual, spec.lt, (left, right) => left < right)) return false
  if (spec.gt != null && !compare(actual, spec.gt, (left, right) => left > right)) return false
  const ops = new Set(['not', 'notIn', 'in', 'gte', 'lte', 'lt', 'gt'])
  if (Object.keys(spec).some((key) => !ops.has(key))) return match(actual, spec)
  if (Object.keys(spec).some((key) => ops.has(key))) return true
  return match(actual, spec)
}

function sortRows(rows: Record<string, unknown>[], orderBy: unknown): Record<string, unknown>[] {
  const keys = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const [field, dir] = Object.entries(key as Record<string, string>)[0]!
      if (a[field] === b[field]) continue
      const cmp = (a[field] as never) < (b[field] as never) ? -1 : 1
      return dir === 'desc' ? -cmp : cmp
    }
    return 0
  })
}

function harness() {
  const queries: { model: string; where: unknown }[] = []
  const audits: { action: string; actorId: string; metadata?: Record<string, unknown> }[] = []
  const db = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      const model = String(prop)
      const rows = (tables[model] ?? []) as Record<string, unknown>[]
      return {
        findMany: async (args: { where?: unknown; orderBy?: unknown; take?: number }) => {
          queries.push({ model, where: args.where })
          const found = sortRows(rows.filter((row) => match(row, args.where)), args.orderBy)
          return args.take ? found.slice(0, args.take) : found
        },
        count: async (args: { where?: unknown } = {}) => {
          queries.push({ model, where: args.where })
          return rows.filter((row) => match(row, args.where)).length
        },
        findUnique: async (args: { where?: unknown }) => rows.find((row) => match(row, args.where)) ?? null,
      }
    },
  })
  const policy = { actor: async (id: string) => (id === ADMIN ? { globalRole: 'PLATFORM_ADMIN' } : id === 'missing' ? null : { globalRole: 'STUDENT' }) }
  const service = new AdminContentService(db as never, policy as never, { record: async (entry: { action: string; actorId: string; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never)
  return { service, queries, audits }
}

const ids = (page: { edges: { node: { id: string } }[] }) => page.edges.map((edge) => edge.node.id)

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run()
  } catch (e) {
    return e as AppError
  }
  throw new Error('expected a rejection')
}

describe('adminContent', () => {
  it('is platform-admin only', async () => {
    const { service, queries, audits } = harness()
    expect((await rejection(() => service.list('student', {}, 20, null))).code).toBe(ErrorCode.FORBIDDEN)
    expect((await rejection(() => service.counts('missing', null, null))).code).toBe(ErrorCode.UNAUTHENTICATED)
    expect(queries).toEqual([])
    expect(audits).toEqual([])
  })

  it('never returns private notes, shares, uploads, highlights, college ID cards or private threads', async () => {
    const { service, queries, audits } = harness()
    const page = await service.list(ADMIN, {}, 100, null)
    const returned = ids(page)
    expect(returned).toEqual(expect.arrayContaining(['n1', 'n-shared', 'c-public', 'g-public', 'g-private', 'f-public', 'h-public', 'n1:ravi']))
    for (const hidden of ['n-private', 'c-private', 'c-thread', 'f-private', 'f-college', 'f-verify', 'f-snap', 'h-private', 'n-private:ravi']) {
      expect(returned).not.toContain(hidden)
    }
    expect(page.edges.find((edge) => edge.node.id === 'n1')!.node.title).toHaveLength(200)
    expect(page.edges.find((edge) => edge.node.id === 'n1')!.node.excerpt).toHaveLength(200)
    expect(page.edges.find((edge) => edge.node.id === 'c-public')!.node.excerpt).toBe('Hello from a public note')
    expect(page.edges.find((edge) => edge.node.id === 'n1')!.node.author).toEqual({ id: ASHA, handle: 'asha', email: 'asha@college.edu' })
    expect(queries.some((query) => query.model === 'note' && JSON.stringify(query.where).includes('"not":"PRIVATE"'))).toBe(true)
    expect(queries.some((query) => query.model === 'fileObject' && JSON.stringify(query.where).includes('COLLEGE_ID'))).toBe(true)
    expect(audits).toEqual([{ action: 'admin.content.browse', actorId: ADMIN, targetType: 'CONTENT', metadata: { type: null, userId: null, handle: null, from: null, to: null, visibility: null } }])
  })

  it('filters by type, person, handle, visibility and time, and pages with a cursor', async () => {
    const { service, audits } = harness()
    const notesOnly = await service.list(ADMIN, { type: 'NOTE' }, 2, null)
    expect(ids(notesOnly)).toEqual(['n1', 'n2'])
    expect(notesOnly.pageInfo.hasNextPage).toBe(true)
    const second = await service.list(ADMIN, { type: 'NOTE' }, 2, notesOnly.pageInfo.endCursor)
    expect(ids(second)).toEqual(['n-shared', 'n3'])
    const third = await service.list(ADMIN, { type: 'NOTE' }, 2, second.pageInfo.endCursor)
    expect(ids(third)).toEqual(['n4', 'n5'])
    expect(third.pageInfo.hasNextPage).toBe(false)

    expect(ids(await service.list(ADMIN, { userId: RAVI }, 100, null))).toEqual(['n-shared'])
    expect(ids(await service.list(ADMIN, { handle: 'asha', type: 'GROUP' }, 100, null))).toEqual(['g-public', 'g-private'])
    expect(ids(await service.list(ADMIN, { handle: 'nobody' }, 100, null))).toEqual([])
    expect(ids(await service.list(ADMIN, { type: 'NOTE', visibility: 'PUBLIC' }, 100, null))).toEqual(['n1', 'n2', 'n3', 'n4', 'n5'])
    expect(ids(await service.list(ADMIN, { visibility: 'PRIVATE' }, 100, null))).toEqual(['g-private'])
    expect(ids(await service.list(ADMIN, { type: 'NOTE', from: at(3000), to: at(4000) }, 100, null))).toEqual(['n2', 'n-shared', 'n3'])
    expect(audits.at(-1)?.metadata).toMatchObject({ type: 'NOTE', from: at(3000).toISOString(), to: at(4000).toISOString() })
  })

  it('counts each kind without private items', async () => {
    const { service } = harness()
    const result = await service.counts(ADMIN, at(1), at(9000))
    const count = (type: string) => result.counts.find((row) => row.type === type)!.count
    expect(count('NOTE')).toBe(6)
    expect(count('COMMENT')).toBe(1)
    expect(count('GROUP')).toBe(2)
    expect(count('SHARE')).toBe(1)
    expect(count('UPLOAD')).toBe(1)
    expect(count('HIGHLIGHT')).toBe(1)
    expect(count('QUIZ')).toBe(0)
    expect(result.counts).toHaveLength(14)
  })
})
