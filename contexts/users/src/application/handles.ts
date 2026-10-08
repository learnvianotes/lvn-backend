import { newId, type Prisma } from '@lvn-backend/prisma-base'
import { handleBase } from '../domain/rules'

/** A handle nobody has: the name's slug, then with a random 4-digit suffix, finally with part of a fresh id. */
export async function freeHandle(tx: Prisma.TransactionClient, displayName: string): Promise<string> {
  const base = handleBase(displayName)
  for (let attempt = 0; attempt < 8; attempt++) {
    const handle = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    if (!(await tx.user.findUnique({ where: { handle }, select: { id: true } }))) return handle
  }
  return `${base}${newId().slice(-8)}`
}
