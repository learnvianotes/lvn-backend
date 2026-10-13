import { hostOf, pictureType, suggestType, urlKeyOf } from '../../src/domain/resources'

describe('resources (ADR-0074)', () => {
  it('keys a link without its scheme, so http and https are one resource', () => {
    expect(urlKeyOf('https://nptel.ac.in/courses/106102064')).toBe(urlKeyOf('http://nptel.ac.in/courses/106102064'))
  })

  it('names the site without www.', () => {
    expect(hostOf('https://www.coursera.org/learn/algorithms')).toBe('coursera.org')
    expect(hostOf('not a url')).toBe('')
  })

  it('suggests a type from the page or the site, and leaves the rest to the person', () => {
    expect(suggestType('https://example.com/x', 'book', null)).toBe('BOOK')
    expect(suggestType('https://example.com/x', null, '9780132350884')).toBe('BOOK')
    expect(suggestType('https://onlinecourses.nptel.ac.in/noc24_cs01', 'website', null)).toBe('COURSE')
    expect(suggestType('https://github.com/torvalds/linux', null, null)).toBe('SOFTWARE')
    expect(suggestType('https://notgithub.com/x', null, null)).toBeNull()
    expect(suggestType('https://example.com/', 'website', null)).toBeNull()
  })

  it('knows a picture by its bytes, not its name', () => {
    expect(pictureType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(pictureType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(pictureType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(pictureType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(pictureType(new TextEncoder().encode('GIF89a'))).toBeNull()
  })
})
