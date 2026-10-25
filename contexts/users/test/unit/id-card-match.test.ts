import { combineJudgements, institutionsMatch, judgeIdCard, namesMatch, shouldAutoApprove } from '../../src/domain/id-card-match'

const profile = { displayName: 'Asha Rao', institutionNames: ['IIT Madras'], domains: ['iitm.ac.in'] }
const reading = { name: 'Asha Rao', institution: 'IIT Madras', idNumber: 'CS21B001', validUntil: null, readable: true, confidence: 0.93 }

describe('ID card comparison', () => {
  it('matches names across titles, order and small spelling differences', () => {
    expect(namesMatch('Dr. Asha Rao', 'Asha Rao')).toBe(true)
    expect(namesMatch('Rao Asha', 'Asha Rao')).toBe(true)
    expect(namesMatch('Asha Rso', 'Asha Rao')).toBe(true)
    expect(namesMatch('Meera Iyer', 'Asha Rao')).toBe(false)
  })

  it('matches an institution by name or email domain', () => {
    expect(institutionsMatch('IIT Madras', ['IIT Madras'], [])).toBe(true)
    expect(institutionsMatch('IITM', [], ['iitm.ac.in'])).toBe(true)
    expect(institutionsMatch('Some Other College', ['IIT Madras'], ['iitm.ac.in'])).toBe(false)
  })

  it('stores match, mismatch and unreadable without rejecting on its own', () => {
    expect(judgeIdCard(reading, profile).verdict).toBe('MATCH')
    expect(judgeIdCard({ ...reading, name: 'Meera Iyer' }, profile)).toMatchObject({ verdict: 'MISMATCH', reason: expect.stringMatching(/name/) })
    expect(judgeIdCard({ ...reading, institution: 'Other College' }, profile).verdict).toBe('MISMATCH')
    expect(judgeIdCard({ ...reading, validUntil: '2020-01-01' }, profile, new Date('2026-10-25T00:00:00Z')).verdict).toBe('MISMATCH')
    expect(judgeIdCard({ ...reading, readable: false }, profile).verdict).toBe('UNREADABLE')
    expect(judgeIdCard(null, profile).verdict).toBe('UNREADABLE')
  })

  it('prefers a match over a mismatch over unreadable', () => {
    const match = judgeIdCard(reading, profile)
    const mismatch = judgeIdCard({ ...reading, name: 'Meera Iyer' }, profile)
    const unreadable = judgeIdCard(null, profile)
    expect(combineJudgements([unreadable, mismatch, match]).verdict).toBe('MATCH')
    expect(combineJudgements([unreadable, mismatch]).verdict).toBe('MISMATCH')
  })

  it('auto-approves only a high-confidence match when the switch is on', () => {
    expect(shouldAutoApprove({ enabled: true, auto: false, threshold: 90, verdict: 'MATCH', confidence: 0.99 })).toBe(false)
    expect(shouldAutoApprove({ enabled: true, auto: true, threshold: 90, verdict: 'MISMATCH', confidence: 0.99 })).toBe(false)
    expect(shouldAutoApprove({ enabled: true, auto: true, threshold: 90, verdict: 'MATCH', confidence: 0.89 })).toBe(false)
    expect(shouldAutoApprove({ enabled: true, auto: true, threshold: 90, verdict: 'MATCH', confidence: 0.9 })).toBe(true)
  })
})
