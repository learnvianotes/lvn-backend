import { PrismaService } from '@lvn-backend/prisma-base'
import type { TestApp } from '../../support/app'
import { seedUser, tokenFor } from '../../support/seed'

export interface Actor {
  id: string
  email: string
  token: string
}

export interface Actors {
  /** Student A */
  a: Actor
  /** Student B */
  b: Actor
  /** Teacher T: verified, globalRole TEACHER */
  teacher: Actor
  admin: Actor
}

/**
 * The §17.1 fixture. Group G (A a member, B not) and Classroom C (B a member, A not) are added in Phase 3, when
 * groups and classrooms exist; until then their assertions are `it.todo`.
 */
export async function seedActors(t: TestApp): Promise<Actors> {
  const make = async (role: 'STUDENT' | 'TEACHER' | 'PLATFORM_ADMIN', name: string, verified = false): Promise<Actor> => {
    const user = await seedUser(t.app, { globalRole: role, displayName: name, verified })
    return { id: user.id, email: user.email, token: tokenFor(t.config, user.id, undefined, [role]) }
  }
  return {
    a: await make('STUDENT', 'Student A'),
    b: await make('STUDENT', 'Student B'),
    teacher: await make('TEACHER', 'Teacher T', true),
    admin: await make('PLATFORM_ADMIN', 'Platform Admin', true),
  }
}

export async function roleOf(t: TestApp, userId: string): Promise<string> {
  return (await t.app.get(PrismaService).user.findUniqueOrThrow({ where: { id: userId }, select: { globalRole: true } })).globalRole
}
