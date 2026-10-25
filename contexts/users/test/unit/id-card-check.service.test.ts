import { writeFile } from 'node:fs/promises'
import { IdCardCheckService } from '../../src/application/id-card-check.service'
import type { IdCardExtraction } from '../../src/domain/id-card-match'
import { STUDENT_ID_AI_AUTO_APPROVE_SETTING, STUDENT_ID_AI_CHECK_SETTING, STUDENT_ID_AI_THRESHOLD_SETTING } from '../../src/domain/setting-catalog'

function harness(opts: { enabled?: boolean; auto?: boolean } = {}) {
  const request: Record<string, unknown> = {
    id: 'req-1',
    userId: 'user-1',
    status: 'PENDING',
    purpose: 'ACCOUNT',
    method: 'DOCUMENTS',
    collegeIdCard: true,
    documentIds: ['file-1'],
    teacherId: null,
  }
  const user: Record<string, unknown> = { id: 'user-1', displayName: 'Asha Rao', verifiedAt: null, verificationMethod: null }
  const audits: { action: string; metadata?: Record<string, unknown> }[] = []
  const events: unknown[][] = []
  const added: unknown[][] = []
  const seen: { bytes: Buffer; mimeType: string }[] = []
  const db = {
    verificationRequest: {
      findUnique: async () => request,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data),
      updateMany: async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
        if (request.status !== where.status) return { count: 0 }
        Object.assign(request, data)
        return { count: 1 }
      },
    },
    user: {
      findUnique: async () => user,
      findUniqueOrThrow: async () => user,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(user, data),
    },
    membership: { findMany: async () => [] },
    institutionalEmail: { findMany: async () => [] },
    organization: { findMany: async () => [{ id: 'org', name: 'IIT Madras', emailDomains: ['iitm.ac.in'] }] },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  const settings = {
    boolean: (key: string, fallback: boolean) => {
      if (key === STUDENT_ID_AI_CHECK_SETTING) return opts.enabled ?? true
      if (key === STUDENT_ID_AI_AUTO_APPROVE_SETTING) return opts.auto ?? false
      return fallback
    },
    integer: (key: string, fallback: number) => (key === STUDENT_ID_AI_THRESHOLD_SETTING ? 90 : fallback),
  }
  const service = new IdCardCheckService(
    db as never,
    settings as never,
    { record: async (entry: { action: string; metadata?: Record<string, unknown> }) => void audits.push(entry) } as never,
    { queue: () => ({ add: async (...args: unknown[]) => void added.push(args) }) } as never,
    { download: async (_id: string, dest: string) => (await writeFile(dest, Buffer.from('image-bytes')), { mimeType: 'image/png' }) } as never,
    { publish: async (...args: unknown[]) => void events.push(args) } as never,
  )
  const extract = async (bytes: Buffer, mimeType: string): Promise<IdCardExtraction> => {
    seen.push({ bytes, mimeType })
    return { name: 'Dr Asha Rao', institution: 'IIT Madras', idNumber: 'CS21B001', validUntil: null, readable: true, confidence: 0.96 }
  }
  return { service, request, user, audits, events, added, seen, extract }
}

describe('IdCardCheckService', () => {
  it('stores a match and leaves the request for a person when auto-approve is off', async () => {
    const h = harness({ auto: false })
    const judgement = await h.service.run('req-1', { extract: h.extract })
    expect(judgement?.verdict).toBe('MATCH')
    expect(h.seen).toEqual([{ bytes: Buffer.from('image-bytes'), mimeType: 'image/png' }])
    expect(h.request).toMatchObject({ status: 'PENDING', aiVerdict: 'MATCH', aiConfidence: 0.96 })
    expect(h.user.verifiedAt).toBeNull()
    expect(h.audits.map((a) => a.action)).toEqual(['verification.ai.checked'])
    expect(JSON.stringify(h.audits)).not.toContain('CS21B001')
    expect(JSON.stringify(h.audits)).not.toContain('image-bytes')
  })

  it('approves a high-confidence match only when auto-approve is on, and does not delete the file', async () => {
    const h = harness({ auto: true })
    await h.service.run('req-1', { extract: h.extract })
    expect(h.request.status).toBe('APPROVED')
    expect(h.request.documentIds).toEqual(['file-1'])
    expect(h.user.verifiedAt).toBeInstanceOf(Date)
    expect(h.audits.map((a) => a.action)).toEqual(['verification.ai.checked', 'verification.approved'])
    expect(h.audits[1]?.metadata).toMatchObject({ actor: 'system:ai' })
    expect(h.events[0]?.[0]).toBe('VerificationDecided')
  })

  it('keeps a mismatch pending', async () => {
    const h = harness({ auto: true })
    const judgement = await h.service.run('req-1', {
      extract: async () => ({ name: 'Meera Iyer', institution: 'IIT Madras', idNumber: null, validUntil: null, readable: true, confidence: 0.99 }),
    })
    expect(judgement?.verdict).toBe('MISMATCH')
    expect(h.request.status).toBe('PENDING')
    expect(h.user.verifiedAt).toBeNull()
  })

  it('stores unreadable when the provider throws, and does not enqueue while the switch is off', async () => {
    const h = harness()
    const judgement = await h.service.run('req-1', {
      extract: async () => {
        throw new Error('provider down')
      },
    })
    expect(judgement?.verdict).toBe('UNREADABLE')
    const off = harness({ enabled: false })
    await off.service.enqueue('req-1')
    expect(off.added).toEqual([])
    expect(await off.service.run('req-1', { extract: h.extract })).toBeNull()
  })
})
