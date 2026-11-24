import { EMPTY_SHA256, canonicalString, parseVerdict, sign, verify } from '../../src'

const secret = 'test-secret-test-secret-test-secret'
const fields = {
  timestamp: '1700000000',
  nonce: 'nonce-nonce-nonce',
  sha256: EMPTY_SHA256,
  contentLength: '0',
  mime: 'application/octet-stream',
}

describe('scanner request signing', () => {
  it('pins the canonical string and the HMAC so the worker and the scanner cannot drift', () => {
    expect(canonicalString(fields)).toBe(`LVN-SCAN-1\n1700000000\nnonce-nonce-nonce\n${EMPTY_SHA256}\n0\napplication/octet-stream\n`)
    expect(sign(secret, fields)).toBe('f7e4bb78f3414f633d14a35a54b19893ac1c38dca556f07d1cffcc6065ed842e')
  })

  it('accepts the signature it just made and rejects a replayed or altered one', () => {
    const signature = sign(secret, fields)
    expect(verify(secret, { ...fields, signature })).toBe(true)
    expect(verify('other-secret-other-secret-other-1', { ...fields, signature })).toBe(false)
    expect(verify(secret, { ...fields, signature, contentLength: '1' })).toBe(false)
    expect(verify(secret, { ...fields, signature: signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0') })).toBe(false)
    expect(verify(secret, { ...fields, signature: 'not-hex' })).toBe(false)
  })

  it('refuses to sign a field that could change the canonical lines', () => {
    expect(() => sign(secret, { ...fields, mime: 'application/pdf\ninfected' })).toThrow(/malformed/)
    expect(() => sign(secret, { ...fields, nonce: 'short' })).toThrow(/malformed/)
  })
})

describe('parseVerdict', () => {
  it('reads a clean verdict, including a missing page count', () => {
    expect(parseVerdict('{"result":"clean","pageCount":4}')).toEqual({ result: 'clean', pageCount: 4 })
    expect(parseVerdict('{"result":"clean"}')).toEqual({ result: 'clean', pageCount: null })
  })

  it('reads infected and unsafe verdicts and drops a signature past 200 characters', () => {
    expect(parseVerdict('{"result":"infected","signature":"Eicar-Test-Signature"}')).toEqual({ result: 'infected', signature: 'Eicar-Test-Signature' })
    const unsafe = parseVerdict(`{"result":"unsafe","signature":"${'x'.repeat(250)}"}`)
    expect(unsafe.result).toBe('unsafe')
    if (unsafe.result === 'unsafe') expect(unsafe.signature).toHaveLength(200)
  })

  it('rejects a verdict the worker must not treat as clean', () => {
    expect(() => parseVerdict('{"result":"clean","pageCount":-1}')).toThrow(/page count/)
    expect(() => parseVerdict('{"result":"infected"}')).toThrow(/unknown verdict/)
    expect(() => parseVerdict('not json')).toThrow(/malformed JSON/)
  })
})
