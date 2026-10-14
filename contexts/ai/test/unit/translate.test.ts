import { plainSymbols } from '../../src/application/page-vision'
import { TASKS } from '../../src/domain/tasks'
import { pieces, scriptShare, titled } from '../../src/domain/translate'

/** Translating a note in checked pieces, and photo readings made plain (ADR-0086). */
describe('translation', () => {
  it('cuts a note between paragraphs, then lines, then sentences, never past the size', () => {
    const para = (n: number) => `Paragraph ${n} ${'word '.repeat(60).trim()}.`
    const text = [1, 2, 3, 4, 5, 6, 7].map(para).join('\n\n')
    const parts = pieces(text, 700)
    expect(parts.every((p) => p.length <= 700)).toBe(true)
    expect(parts.join('\n\n')).toBe(text)
    const long = `${'A sentence of the long paragraph. '.repeat(40).trim()}`
    expect(pieces(long, 300).every((p) => p.length <= 300)).toBe(true)
    expect(pieces(long, 300).join(' ').replace(/\s+/g, ' ')).toBe(long)
  })

  it('tells how much of a translation is in the language’s script, leaving out code and formulas', () => {
    expect(scriptShare('మీ మార్గంలోని ఇతర స్టేషన్ల నుండి అదే రైలు కోసం టిక్కెట్లను బుక్ చేసుకోండి', 'TELUGU')).toBeGreaterThan(0.9)
    expect(scriptShare('Book available tickets for the same train from other stations on your route', 'TELUGU')).toBe(0)
    expect(scriptShare('हीप में सबसे छोटा तत्व हमेशा ऊपर रहता है ```python\nheapq.heappush(queue, item)\n```', 'HINDI')).toBeGreaterThan(0.9)
    expect(scriptShare('O(n)', 'HINDI')).toBeNull()
  })

  it('takes the title from the first line, and makes Markdown of the translation', () => {
    expect(titled('# త్వరిత గమనిక\n\nమరిన్ని రైళ్లు')).toEqual({ title: 'త్వరిత గమనిక', text: 'మరిన్ని రైళ్లు' })
    expect(titled('<content>\nNo title here.\n</content>')).toEqual({ title: '', text: 'No title here.' })
    expect(TASKS.TRANSLATE.result('# हीप\n\nसबसे छोटा ऊपर।', 'Heaps')).toEqual({ markdown: '## हीप\n\nसबसे छोटा ऊपर।' })
  })

  it('makes the LaTeX a photo reading slips into words plain, and leaves real mathematics', () => {
    expect(plainSymbols('Bengaluru (SBC) $\\rightarrow$ Puducherry · $\\text{8 km from SBC}$ 21:20 $\\quad$ 09h 55m')).toBe('Bengaluru (SBC) → Puducherry · 8 km from SBC 21:20  09h 55m')
    // A backslash the model did not escape in its JSON arrives as a tab or a carriage return.
    expect(plainSymbols('$\text{8 km}$ and $\rightarrow$')).toBe('8 km and →')
    expect(plainSymbols('Area is $\\pi r^2$ and $\\frac{a}{b}$')).toBe('Area is $\\pi r^2$ and $\\frac{a}{b}$')
  })
})
