import { LimitKey } from '@lvn/contracts/domain'
import { EntitlementService } from '../../src/application/entitlement.service'
import { PublicPlansService, type PublicPlanView } from '../../src/application/public-plans.service'

const FREE = '01920000-0000-7000-8000-000000000001'
const PLUS = '01920000-0000-7000-8000-000000000201'

interface Entitlement {
  key: string
  limit: bigint | null
  appliesToRole: string | null
}

interface Plan {
  id: string
  code: string
  name: string
  priceMinor: number
  currency: string
  interval: 'NONE' | 'MONTH' | 'YEAR'
  features: string[]
  active: boolean
  entitlements: Entitlement[]
}

const free: Plan = {
  id: FREE,
  code: 'FREE',
  name: 'Free',
  priceMinor: 0,
  currency: 'INR',
  interval: 'NONE',
  features: ['Notes'],
  active: true,
  entitlements: [
    { key: 'STORAGE_BYTES', limit: 5368709120n, appliesToRole: 'STUDENT' },
    { key: 'STORAGE_BYTES', limit: 21474836480n, appliesToRole: 'TEACHER' },
    { key: 'AI_TOKENS_DAILY', limit: 200000n, appliesToRole: 'STUDENT' },
    { key: 'EXPORTS_DAILY', limit: 1n, appliesToRole: 'STUDENT' },
    { key: 'NOTES_OWNED', limit: null, appliesToRole: null },
  ],
}

const plus: Plan = {
  id: PLUS,
  code: 'PLUS',
  name: 'Plus',
  priceMinor: 49900,
  currency: 'INR',
  interval: 'MONTH',
  features: ['More AI'],
  active: true,
  entitlements: [
    { key: 'AI_REQUESTS_DAILY', limit: 50n, appliesToRole: 'STUDENT' },
    { key: 'NOTES_OWNED', limit: 100n, appliesToRole: null },
  ],
}

const hidden: Plan = { ...plus, id: 'hidden', code: 'OLD', name: 'Old', priceMinor: 100, active: false, entitlements: [] }

function dbFor(opts: { planId: string | null; role?: string; plans?: Plan[] }) {
  const plans = opts.plans ?? [plus, free, hidden]
  return {
    plan: {
      findMany: async () => plans.filter((plan) => plan.active),
      findUniqueOrThrow: async ({ where }: { where: { id?: string; code?: string } }) => {
        const row = plans.find((plan) => plan.id === where.id || plan.code === where.code)
        if (!row) throw new Error(`missing plan ${where.id ?? where.code}`)
        return row
      },
    },
    user: {
      findUniqueOrThrow: async () => ({ globalRole: opts.role ?? 'STUDENT', plan: opts.planId ? { planId: opts.planId } : null }),
    },
    dataExport: { count: async () => 1 },
    membership: { count: async () => 0 },
    entitlement: {
      findMany: async ({ where }: { where: { planId: string } }) => plans.find((plan) => plan.id === where.planId)?.entitlements ?? [],
    },
  }
}

const usage = {
  notes: async () => ({ [LimitKey.NOTES_OWNED]: 4n, [LimitKey.STORAGE_BYTES]: 10n, [LimitKey.PDF_PAGES_MONTHLY]: 2n, [LimitKey.IMPORTS_DAILY]: 1n }),
  ai: async () => ({ [LimitKey.AI_TOKENS_DAILY]: 20n, [LimitKey.AI_REQUESTS_DAILY]: 3n }),
  core: async () => ({ [LimitKey.GROUPS_OWNED]: 0n, [LimitKey.GROUP_MEMBERS]: 0n, [LimitKey.CLASSROOMS_OWNED]: 0n, [LimitKey.CLASSROOM_MEMBERS]: 0n, [LimitKey.PROJECT_WORKSPACES]: 0n }),
}

function service(opts: { planId: string | null; role?: string; plans?: Plan[] }) {
  const db = dbFor(opts)
  return new PublicPlansService(db as never, { used: usage.notes }, { used: usage.ai }, { used: usage.core })
}

const limitOf = (plan: PublicPlanView, key: string) => plan.limits.find((row) => row.key === key)

describe('plans and myPlan', () => {
  it('lists active plans cheapest first, and marks none current when signed out', async () => {
    const listed = await service({ planId: null }).list(null)
    expect(listed.map((plan) => plan.code)).toEqual(['FREE', 'PLUS'])
    expect(listed.every((plan) => plan.current === false)).toBe(true)
    expect(limitOf(listed[0]!, 'STORAGE_BYTES')).toMatchObject({ label: 'storage', limit: '5368709120' })
    expect(limitOf(listed[0]!, 'NOTES_OWNED')).toMatchObject({ label: 'notes', limit: null })
  })

  it('marks FREE current for an account with no subscription', async () => {
    const plans = service({ planId: null })
    const listed = await plans.list('user')
    expect(listed.find((plan) => plan.code === 'FREE')!.current).toBe(true)
    expect(listed.find((plan) => plan.code === 'PLUS')!.current).toBe(false)
    const mine = await plans.mine('user')
    expect(mine.plan.code).toBe('FREE')
    expect(mine.plan.current).toBe(true)
    const notes = mine.usage.find((row) => row.key === 'NOTES_OWNED')!
    expect(notes).toMatchObject({ used: '4', limit: null, label: 'notes', resetsAt: null })
    const asks = mine.usage.find((row) => row.key === 'AI_REQUESTS_DAILY')!
    expect(asks).toMatchObject({ used: '3', limit: null, label: 'AI asks a day' })
    expect(asks.resetsAt).toBeInstanceOf(Date)
    const pages = mine.usage.find((row) => row.key === 'PDF_PAGES_MONTHLY')!
    expect(pages.resetsAt).toBeInstanceOf(Date)
    expect(pages.resetsAt!.getUTCDate()).toBe(1)
    expect(mine.usage.find((row) => row.key === 'EXPORTS_DAILY')).toMatchObject({ used: '1', limit: '1' })
  })

  it('uses the subscribed plan, including one that is hidden from the list', async () => {
    const plans = service({ planId: 'hidden', plans: [free, hidden] })
    expect((await plans.list('user')).map((plan) => plan.code)).toEqual(['FREE'])
    const mine = await plans.mine('user')
    expect(mine.plan).toMatchObject({ code: 'OLD', current: true })
    expect(mine.usage.find((row) => row.key === 'AI_REQUESTS_DAILY')!.limit).toBeNull()
  })

  it('shows a teacher the teacher storage cap and a plus subscriber their caps', async () => {
    const teacher = await service({ planId: null, role: 'TEACHER' }).list('teacher')
    expect(limitOf(teacher[0]!, 'STORAGE_BYTES')!.limit).toBe('21474836480')
    const mine = await service({ planId: PLUS }).mine('student')
    expect(mine.plan.code).toBe('PLUS')
    expect(mine.usage.find((row) => row.key === 'AI_REQUESTS_DAILY')).toMatchObject({ limit: '50', used: '3' })
    expect(mine.usage.find((row) => row.key === 'NOTES_OWNED')).toMatchObject({ limit: '100', used: '4' })
  })
})

describe('entitlements fall back to FREE', () => {
  it('reads FREE when the account has no subscription, and unlimited when FREE has no row', async () => {
    const entitlements = new EntitlementService(dbFor({ planId: null }) as never)
    await expect(entitlements.limit('user', LimitKey.STORAGE_BYTES)).resolves.toBe(5368709120n)
    await expect(entitlements.limit('user', LimitKey.AI_REQUESTS_DAILY)).resolves.toBeNull()
  })

  it('reads the subscribed plan instead of FREE', async () => {
    const entitlements = new EntitlementService(dbFor({ planId: PLUS }) as never)
    await expect(entitlements.limit('user', LimitKey.NOTES_OWNED)).resolves.toBe(100n)
    await expect(entitlements.limit('user', LimitKey.AI_REQUESTS_DAILY)).resolves.toBe(50n)
  })
})
