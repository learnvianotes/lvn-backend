import { ErrorCode } from '@lvn-backend/errors'
import type { Prisma } from '@lvn-backend/prisma-base'
import { changeHandle, freeHandle } from '../../src/application/handles'
import { isReservedHandle } from '../../src/domain/rules'
import { STUDY_PUBLISHER_EMAIL, STUDY_PUBLISHER_ID } from '../../src/domain/study-publisher'

interface Row {
  id: string
  email: string
  handle: string
}

/** A users table that only answers the handle queries sign-up and handle edits make. */
function memory(rows: Row[]): Prisma.TransactionClient {
  const fold = (handle: string) => handle.toLowerCase()
  const find = (where: { id?: string; handle?: string | { equals: string } }) => {
    if (where.id) return rows.find((row) => row.id === where.id) ?? null
    const handle = typeof where.handle === 'string' ? where.handle : where.handle?.equals
    if (!handle) return null
    return rows.find((row) => fold(row.handle) === fold(handle)) ?? null
  }
  return {
    user: {
      findUnique: async ({ where }: { where: { id?: string; handle?: string } }) => find(where),
      findFirst: async ({ where }: { where: { id?: string; handle?: { equals: string } } }) => find(where),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((item) => item.id === where.id)
        if (!row) throw new Error('missing user')
        Object.assign(row, data)
        return row
      },
    },
  } as unknown as Prisma.TransactionClient
}

describe('freeHandle (email sign-up and Google sign-up)', () => {
  it('does not give LearnViaNotes, or any other brand or role name, the reserved handle', async () => {
    const names = ['LearnViaNotes', 'Learn-Via-Notes', 'LVN', 'Admin', 'Support', 'Official', 'System', 'Publisher']
    for (const displayName of names) {
      const handle = await freeHandle(memory([]), displayName)
      expect(handle).toBe('learner')
      expect(isReservedHandle(handle)).toBe(false)
      expect(handle).not.toBe('learnvianotes')
    }
  })

  it('keeps an ordinary name, then adds digits when that slug is taken', async () => {
    expect(await freeHandle(memory([]), 'Asha Rao')).toBe('asharao')
    const taken = memory([{ id: 'u1', email: 'a@example.com', handle: 'asharao' }])
    await expect(freeHandle(taken, 'Asha Rao')).resolves.toMatch(/^asharao\d{4}$/)
  })

  it('adds digits when learner, the fallback for a reserved name, is already taken', async () => {
    const taken = memory([{ id: 'u1', email: 'a@example.com', handle: 'learner' }])
    const handle = await freeHandle(taken, 'LearnViaNotes')
    expect(handle).toMatch(/^learner\d{4}$/)
    expect(isReservedHandle(handle)).toBe(false)
  })
})

describe('changeHandle', () => {
  const person = (): Row[] => [{ id: 'u1', email: 'asha@example.com', handle: 'asharao' }]

  it.each(['learnvianotes', 'LearnViaNotes', 'learn-via-notes', 'LVN', 'lvn-official', 'admin', 'support', 'official', 'system', 'publisher', 'moderator', 'staff'])(
    'refuses to change a handle to %s',
    async (handle) => {
      const rows = person()
      await expect(changeHandle(memory(rows), 'u1', handle)).rejects.toMatchObject({ code: ErrorCode.VALIDATION, message: 'That handle is reserved.' })
      expect(rows[0]!.handle).toBe('asharao')
    },
  )

  it('stores a free handle and refuses one someone else has', async () => {
    const rows = person()
    await expect(changeHandle(memory(rows), 'u1', 'Asha-Writes')).resolves.toBe('ashawrites')
    expect(rows[0]!.handle).toBe('ashawrites')

    rows.push({ id: 'u2', email: 'ravi@example.com', handle: 'ravinotes' })
    await expect(changeHandle(memory(rows), 'u1', 'ravinotes')).rejects.toMatchObject({ code: ErrorCode.CONFLICT, message: 'That handle is taken.' })
    expect(rows[0]!.handle).toBe('ashawrites')
  })

  it('does not let the system publisher be renamed', async () => {
    const rows = [{ id: STUDY_PUBLISHER_ID, email: STUDY_PUBLISHER_EMAIL, handle: 'learnvianotes' }]
    await expect(changeHandle(memory(rows), STUDY_PUBLISHER_ID, 'asharao')).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    expect(rows[0]!.handle).toBe('learnvianotes')
  })
})
