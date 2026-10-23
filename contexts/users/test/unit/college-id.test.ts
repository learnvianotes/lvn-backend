import { CollegeIdCardLimits } from '@lvn/contracts/domain'
import { ErrorCode } from '@lvn-backend/errors'
import { checkedCollegeIdFile, COLLEGE_ID_OFF } from '../../src/domain/college-id'

describe('checkedCollegeIdFile', () => {
  const ok = { fileName: 'college-id.png', mimeType: 'image/png', sizeBytes: 1200 }

  it('accepts a photo or PDF within 5 MB and strips a path from the name', () => {
    expect(checkedCollegeIdFile({ ...ok, fileName: 'scans/college-id.png' })).toEqual({ ...ok, fileName: 'scanscollege-id.png' })
    expect(checkedCollegeIdFile({ fileName: 'letter.pdf', mimeType: 'application/pdf', sizeBytes: CollegeIdCardLimits.maxBytes }).mimeType).toBe('application/pdf')
  })

  it('refuses an empty name, a wrong type, an empty file and a file over 5 MB', () => {
    const cases: { input: { fileName: string; mimeType: string; sizeBytes: number }; field: string }[] = [
      { input: { ...ok, fileName: '  / ' }, field: 'fileName' },
      { input: { ...ok, mimeType: 'image/gif' }, field: 'mimeType' },
      { input: { ...ok, sizeBytes: 0 }, field: 'sizeBytes' },
      { input: { ...ok, sizeBytes: CollegeIdCardLimits.maxBytes + 1 }, field: 'sizeBytes' },
    ]
    for (const c of cases) {
      expect(() => checkedCollegeIdFile(c.input)).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION, field: ['input', c.field] }))
    }
  })

  it('names the off switch in words a student can read', () => {
    expect(COLLEGE_ID_OFF).toMatch(/off for now/)
  })
})