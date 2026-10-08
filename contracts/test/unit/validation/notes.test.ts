import { folderNameSchema, noteTitleSchema, slugify, tagNameSchema, topicTitleSchema } from '../../../src/validation/notes'

describe('note names and slugs', () => {
  it('tidies whitespace in titles and allows an empty one', () => {
    expect(noteTitleSchema.parse('  Binary   search\n trees ')).toBe('Binary search trees')
    expect(noteTitleSchema.parse('')).toBe('')
    expect(noteTitleSchema.safeParse('x'.repeat(201)).success).toBe(false)
    expect(noteTitleSchema.safeParse('a\u0007b').success).toBe(false) // control characters are refused
  })

  it('needs names for folders, tags and topics', () => {
    expect(folderNameSchema.safeParse('   ').success).toBe(false)
    expect(tagNameSchema.parse('##exam prep')).toBe('exam prep')
    expect(tagNameSchema.safeParse('#').success).toBe(false)
    expect(topicTitleSchema.safeParse('a').success).toBe(false)
  })

  it('makes ASCII slugs for URLs', () => {
    expect(slugify('Binary Search — O(log n)!')).toBe('binary-search-o-log-n')
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu')
    expect(slugify('हिन्दी नोट्स')).toBe('note')
    expect(slugify('x'.repeat(100)).length).toBe(60)
  })
})
