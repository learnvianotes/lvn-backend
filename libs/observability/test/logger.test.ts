import { createLogger, logContext, PinoNestLogger, requestIdFrom, withJobContext } from '../src'

/** A logger writing to memory; `lines()` parses what it wrote. */
function memoryLogger(level: 'info' | 'debug' = 'info') {
  const out: string[] = []
  const logger = createLogger({ service: 'lvn-test', env: 'development', level, destination: { write: (s: string) => void out.push(s) } })
  return { logger, lines: () => out.map((l) => JSON.parse(l) as Record<string, unknown>) }
}

describe('createLogger', () => {
  it('writes one JSON object per line with level name, ISO time, service and environment', () => {
    const { logger, lines } = memoryLogger()
    logger.info('ready')
    expect(lines()[0]).toMatchObject({ level: 'info', service: 'lvn-test', env: 'development', msg: 'ready' })
    expect(new Date(String(lines()[0]!.time)).toISOString()).toBe(lines()[0]!.time)
  })

  it('never writes credentials, tokens, codes, the date of birth or the age', () => {
    const { logger, lines } = memoryLogger()
    logger.info({
      password: 'hunter2hunter2',
      input: { refreshToken: 'r-123', code: '123456', dateOfBirth: '2004-05-01', age: 47, email: 'asha@example.com' },
      user: { declaredAge: 53 },
      req: { headers: { authorization: 'Bearer abc', cookie: 'lvn_rt=xyz', 'user-agent': 'jest' } },
    })
    const logged = { ...lines()[0] }
    delete logged.time
    const text = JSON.stringify(logged)
    for (const secret of ['hunter2hunter2', 'r-123', '123456', '2004-05-01', '47', '53', 'Bearer abc', 'lvn_rt=xyz']) expect(text).not.toContain(secret)
    expect(lines()[0]).toMatchObject({ password: '[redacted]', input: { email: 'asha@example.com' }, req: { headers: { 'user-agent': 'jest' } } })
  })

  it('adds the request or job context to every line written inside it', async () => {
    const { logger, lines } = memoryLogger()
    logger.info('outside')
    await logContext.run({ requestId: 'req-12345678' }, async () => {
      await Promise.resolve()
      logger.info('inside')
    })
    await withJobContext('users.maintenance', 'job-1', async () => void logger.info('job'))
    expect(lines()[0]).not.toHaveProperty('requestId')
    expect(lines()[1]).toMatchObject({ requestId: 'req-12345678', msg: 'inside' })
    expect(lines()[2]).toMatchObject({ queue: 'users.maintenance', jobId: 'job-1' })
  })
})

describe('requestIdFrom', () => {
  it('keeps a well-formed client id and replaces anything else', () => {
    expect(requestIdFrom('abc-1234_5678')).toBe('abc-1234_5678')
    expect(requestIdFrom(['abc-1234_5678', 'other'])).toBe('abc-1234_5678')
    for (const bad of [undefined, '', 'short', 'has space in it', 'x'.repeat(65), 'line\nbreak-injection']) {
      expect(requestIdFrom(bad)).toMatch(/^[0-9a-f-]{36}$/)
    }
  })
})

describe('PinoNestLogger', () => {
  it('maps Nest’s calls to levels and keeps the context name and stack', () => {
    const { logger, lines } = memoryLogger('debug')
    const nest = new PinoNestLogger(logger)
    nest.log('Mapped {/graphql, POST}', 'RouterExplorer')
    nest.warn('slow')
    nest.debug('detail', 'Ctx')
    nest.error('boom', 'Error: boom\n    at handler (x.ts:1:1)', 'ExceptionsHandler')
    nest.error(new Error('kaput'))
    expect(lines().map((l) => [l.level, l.msg, l.context])).toEqual([
      ['info', 'Mapped {/graphql, POST}', 'RouterExplorer'],
      ['warn', 'slow', undefined],
      ['debug', 'detail', 'Ctx'],
      ['error', 'boom', 'ExceptionsHandler'],
      ['error', 'kaput', undefined],
    ])
    expect(lines()[3]!.stack).toContain('at handler')
    expect((lines()[4]!.err as { type: string }).type).toBe('Error')
  })
})
