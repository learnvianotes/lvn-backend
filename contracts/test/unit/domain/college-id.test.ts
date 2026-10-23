import { CollegeIdCardLimits, collegeIdFileName, isCollegeIdMimeType } from '../../../src/domain/college-id'

describe('college ID card limits (ADR-0099)', () => {
  it('accepts a photo or a PDF and stops at 5 MB', () => {
    expect(CollegeIdCardLimits.maxBytes).toBe(5 * 1024 ** 2)
    expect(CollegeIdCardLimits.mimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    expect(isCollegeIdMimeType('image/png')).toBe(true)
    expect(isCollegeIdMimeType('image/gif')).toBe(false)
    expect(isCollegeIdMimeType('text/html')).toBe(false)
  })

  it('keeps a display name and drops path separators and control characters', () => {
    expect(collegeIdFileName('../id card.png')).toBe('..id card.png')
    expect(collegeIdFileName('  a/b\\c.png  ')).toBe('abc.png')
    expect(collegeIdFileName('id\u0000.png')).toBe('id.png')
    expect(collegeIdFileName('   /\\ ')).toBe('')
    expect(collegeIdFileName('n'.repeat(300)).length).toBe(255)
  })
})
