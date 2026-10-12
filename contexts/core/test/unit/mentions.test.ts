import { handlesIn } from '../../src/application/mentions.service'

/** Which handles a text names (ADR-0054): handles are lowercase letters and digits. */
describe('handlesIn', () => {
  it('reads handles at the start or after a space or punctuation, once each, lowercased', () => {
    expect(handlesIn('@asha thanks, (@Ravi) and @asha again; ask @me')).toEqual(['asha', 'ravi'])
  })

  it('never reads an email address, a handle too short, or a plain word', () => {
    expect(handlesIn('mail meera@example.com or a.b@c.de')).toEqual([])
    expect(handlesIn('@ab is too short; no mentions here')).toEqual([])
  })
})
