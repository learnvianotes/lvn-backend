import { AppError, ErrorCode, Errors, toUserError, withUserErrors, type UserError } from '../../src'

type Ok = { ok: boolean; userErrors: UserError[] }

describe('withUserErrors', () => {
  it('returns the result with no userErrors on success', async () => {
    expect(await withUserErrors<Ok>(async () => ({ ok: true }), { ok: false })).toEqual({ ok: true, userErrors: [] })
  })

  it.each([
    Errors.validation('Too short', ['input', 'password']),
    Errors.conflict('Taken'),
    Errors.notFound(),
    Errors.rateLimited(60),
  ])('turns $code into a userError', async (err) => {
    const out = await withUserErrors<Ok>(async () => { throw err }, { ok: false })
    expect(out).toEqual({ ok: false, userErrors: [toUserError(err)] })
  })

  it.each([Errors.unauthenticated(), Errors.forbidden(), new Error('boom')])('rethrows %p', async (err) => {
    await expect(withUserErrors<Ok>(async () => { throw err }, { ok: false })).rejects.toBe(err)
  })
})

describe('AppError', () => {
  it('carries the code, field and retry delay', () => {
    const e = Errors.rateLimited(30)
    expect(e).toBeInstanceOf(AppError)
    expect(e.code).toBe(ErrorCode.RATE_LIMITED)
    expect(e.retryAfter).toBe(30)
    expect(toUserError(Errors.validation('Bad', ['input', 'x']))).toEqual({ code: 'VALIDATION', message: 'Bad', field: ['input', 'x'], retryAfter: null })
    expect(toUserError(Errors.rateLimited(30)).retryAfter).toBe(30)
  })
})
