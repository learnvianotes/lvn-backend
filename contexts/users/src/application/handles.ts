import { Errors } from '@lvn-backend/errors'
import { newId, type Prisma } from '@lvn-backend/prisma-base'
import { handleBase, handleSchema, isReservedHandle } from '../domain/rules'
import { isStudyPublisher } from '../domain/study-publisher'
import { parseField } from './input'

/**
 * A handle nobody has, and never a reserved brand or role handle. Email sign-up and Google sign-up both use this.
 * The name's slug first (already clear of reserved handles), then a 4-digit suffix, then part of a fresh id.
 */
export async function freeHandle(tx: Prisma.TransactionClient, displayName: string): Promise<string> {
  const stem = handleBase(displayName)
  const base = isReservedHandle(stem) ? 'learner' : stem
  for (let attempt = 0; attempt < 8; attempt++) {
    const handle = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    if (isReservedHandle(handle)) continue
    if (!(await tx.user.findUnique({ where: { handle }, select: { id: true } }))) return handle
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = `${base.slice(0, 12)}${newId().replace(/-/g, '').slice(-8)}`
    if (isReservedHandle(handle)) continue
    if (!(await tx.user.findUnique({ where: { handle }, select: { id: true } }))) return handle
  }
  throw new Error('No free handle is available for this name.')
}

/**
 * A person changing their own handle. The same reserved list as sign-up: `learnvianotes`, `learn-via-notes`,
 * `lvn`, `admin`, `support`, `official`, `system`, `publisher` and the same kind of name are refused.
 * The system publisher cannot be renamed onto a person's handle, or off its own.
 */
export async function changeHandle(tx: Prisma.TransactionClient, userId: string, handle: string): Promise<string> {
  const next = parseField(handleSchema, handle, 'handle')
  const current = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!current) throw Errors.notFound('No such account.')
  if (isStudyPublisher(current)) throw Errors.forbidden('This account cannot change its handle.')
  const owner = await tx.user.findFirst({ where: { handle: { equals: next, mode: 'insensitive' } }, select: { id: true } })
  if (owner && owner.id !== userId) throw Errors.conflict('That handle is taken.', ['input', 'handle'])
  await tx.user.update({ where: { id: userId }, data: { handle: next } })
  return next
}
