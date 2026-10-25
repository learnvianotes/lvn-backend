import type { NextFunction, Request, Response } from 'express'
import type { Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import { logContext, requestIdFrom } from './log-context'

/**
 * One access-log line per request (method, path without query, status, duration, request id, GraphQL operation) and
 * the request id on every other line written while handling it. The id comes from X-Request-Id when well-formed and
 * is echoed in the response so a person reporting a problem can quote it. Health checks are not logged.
 */
export function httpLogging(logger: Logger) {
  const http = pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = requestIdFrom(req.headers['x-request-id'])
      res.setHeader('x-request-id', id)
      return id
    },
    customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
    quietReqLogger: true,
    autoLogging: { ignore: (req) => (urlOf(req) ?? '').startsWith('/health') },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    // originalUrl: by the time the response finishes, routers have rewritten req.url to their mount-relative path.
    customSuccessMessage: (req, res) => `${req.method} ${pathOf(urlOf(req))} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${pathOf(urlOf(req))} ${res.statusCode}`,
    customProps: (req) => {
      const operation = (req as Request & { graphqlOperation?: string }).graphqlOperation
      return operation ? { operation } : {}
    },
    serializers: {
      req: (req: { method?: string; url?: string }) => ({ method: req.method, path: pathOf(req.url) }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
  })
  return (req: Request, res: Response, next: NextFunction) =>
    http(req, res, () => logContext.run({ requestId: String(req.id) }, next))
}

const urlOf = (req: { url?: string }) => (req as { originalUrl?: string }).originalUrl ?? req.url

/** The path only: query strings can carry tokens (e.g. emailed links) and are never logged. */
const pathOf = (url: string | undefined) => (url ?? '').split('?')[0]

/** Records the GraphQL operation name for the access log and every later line of the request. */
export function noteOperation(req: unknown, operation: string | null | undefined): void {
  if (!operation) return
  ;(req as { graphqlOperation?: string }).graphqlOperation = operation
  const ctx = logContext.getStore()
  if (ctx) ctx.operation = operation
}

/** Records the signed-in account id for error reports. Email and name are never stored here. */
export function noteViewer(userId: string | null | undefined): void {
  const ctx = logContext.getStore()
  if (ctx && userId) ctx.userId = userId
}
