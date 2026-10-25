import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PromptLibrary } from '../../src/application/prompts'
import { idCardPreference } from '../../src/domain/id-card-route'
import { mediaTypeOf } from '../../src/domain/provider'

describe('ID card AI route', () => {
  it('prefers a private Gemini Flash model, then GPT-4o-mini', () => {
    expect(idCardPreference({ kind: 'GEMINI', model: 'gemini-2.5-flash', mayReceivePrivate: true })).toBe(0)
    expect(idCardPreference({ kind: 'OPENAI', model: 'gpt-4o-mini', mayReceivePrivate: true })).toBe(1)
    expect(idCardPreference({ kind: 'OLLAMA', model: 'gemma4', mayReceivePrivate: true })).toBe(2)
    expect(idCardPreference({ kind: 'GEMINI', model: 'gemini-2.5-flash', mayReceivePrivate: false })).toBeNull()
    expect(idCardPreference({ kind: 'OPENAI', model: 'gpt-4o-mini', mayReceivePrivate: false })).toBeNull()
  })

  it('the prompt carries no account fields, and a PDF is recognised from its bytes', () => {
    const source = readFileSync(path.join(__dirname, '../../prompts/id-card-check.md'), 'utf8')
    expect(source).not.toContain('{{')
    const text = new PromptLibrary().render('id-card-check').messages.map((m) => m.content).join('\n')
    expect(text.toLowerCase()).not.toMatch(/display\s*name|e-?mail|profile|user id/)
    expect(text).not.toContain('@')
    expect(mediaTypeOf(Buffer.from('%PDF-1.4').toString('base64'))).toBe('application/pdf')
  })
})
