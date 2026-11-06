import type { NextFunction, Request, Response } from 'express'

/**
 * Browser origins allowed to call GraphQL. Credentials are on, so the allow-list is echoed back as a single
 * origin and never as `*`. A missing Origin (the mobile app, curl, same-host calls) gets no CORS headers and
 * is still served. A present origin that is not on the list also gets no CORS headers: the browser hides the
 * response, and the API does not fail the request.
 */
export const GRAPHQL_CORS_METHODS = 'GET, POST, OPTIONS'
/**
 * `content-type` and `authorization` are what the web and mobile clients send. Apollo Server's
 * `csrfPrevention` accepts a request that is not a "simple" content type, or that carries
 * `apollo-require-preflight` (Apollo Client's HttpLink) or `x-apollo-operation-name`.
 */
export const GRAPHQL_CORS_HEADERS = 'apollo-require-preflight, authorization, content-type, x-apollo-operation-name'
export const GRAPHQL_CORS_MAX_AGE_SECONDS = '600'

export function isGraphqlPath(path: string): boolean {
  return path === '/graphql' || path.startsWith('/graphql/')
}

/** One Origin header value, or undefined when the header is missing or not a single origin. */
export function singleOrigin(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value
  return raw ? raw : undefined
}

/** CORS for `/graphql` and `/graphql/*` only. `/health/*`, `/webhooks/*` and everything else are left untouched. */
export function graphqlCors(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins)
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isGraphqlPath(req.path)) {
      next()
      return
    }
    const origin = singleOrigin(req.headers.origin)
    const ok = origin !== undefined && allowed.has(origin)
    if (origin !== undefined) res.vary('Origin')
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (req.method === 'OPTIONS') {
      if (ok) {
        res.setHeader('Access-Control-Allow-Methods', GRAPHQL_CORS_METHODS)
        res.setHeader('Access-Control-Allow-Headers', GRAPHQL_CORS_HEADERS)
        res.setHeader('Access-Control-Max-Age', GRAPHQL_CORS_MAX_AGE_SECONDS)
      }
      res.status(204).end()
      return
    }
    next()
  }
}
