import { builtInWords, parseWordList, score } from '../../src/domain/rule-scorer'

/** ADR-0037: the rule-based scorer holds what rules see reliably, and leaves ordinary study notes alone. */
describe('the rule-based moderation scorer', () => {
  const words = [...builtInWords(), ...parseWordList('# owner list\nHATE: badword\nnot a rule\nNOPE: x\nSEXUAL:  two words ')]

  it('leaves ordinary notes alone, links and capitals included', () => {
    const notes = [
      { title: 'Binary search', text: 'Halve the range each step.\nSee https://en.wikipedia.org/wiki/Binary_search for more.' },
      { title: 'OSI MODEL', text: 'PHYSICAL, DATA LINK, NETWORK, TRANSPORT, SESSION, PRESENTATION, APPLICATION' },
      { title: 'Loops', text: Array.from({ length: 6 }, () => 'for (let i = 0; i < n; i++) {}').join('\n') },
      { title: 'Scunthorpe', text: 'A badwordsmith is not the word.' },
    ]
    for (const n of notes) expect(score(n, words)).toEqual({ flagged: false, reason: null, message: null })
  })

  it('holds spam phrases and words from the list, whole words only, ignoring case', () => {
    expect(score({ title: 'Easy', text: 'Buy   Followers today' }, words)).toMatchObject({ flagged: true, reason: 'SPAM' })
    expect(score({ title: 'BADWORD', text: '' }, words)).toMatchObject({ flagged: true, reason: 'HATE', message: 'it contains words linked to hate.' })
    expect(score({ title: 'x', text: 'they said two words here' }, words)).toMatchObject({ flagged: true, reason: 'SEXUAL' })
  })

  it('holds pages of links and text repeated over and over', () => {
    const links = Array.from({ length: 12 }, (_, i) => `https://spam.example/${i}`).join(' ')
    expect(score({ title: 'Links', text: links }, words)).toMatchObject({ flagged: true, reason: 'SPAM', message: 'it is mostly links.' })
    const repeated = Array.from({ length: 10 }, () => 'join my channel now').join('\n')
    expect(score({ title: 'Hi', text: repeated }, words)).toMatchObject({ flagged: true, reason: 'SPAM', message: 'the same text repeats many times.' })
  })

  it('skips word-list lines it cannot read', () => {
    expect(parseWordList('HATE: a\nWRONG: b\njust text\n# HATE: c').map((w) => [w.reason, w.phrase])).toEqual([['HATE', 'a']])
  })
})
