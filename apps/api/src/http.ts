import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { ApiConfig } from '@lvn-backend/config'
import { SUBGRAPH_PATH_PREFIX } from '@lvn-backend/graphql'
import { httpLogging, type Logger } from '@lvn-backend/observability'
import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { graphqlCors } from './cors'

/** HTTP hardening and the access log, shared by main.ts and the e2e tests (§7.2, §16.5). */
export function configureHttp(app: INestApplication, config: Pick<ApiConfig, 'CORS_ORIGINS' | 'TRUST_PROXY_HOPS'>, logger: Logger): void {
  // req.ip is the client's address only when the proxies in front are trusted, and only as many as there are.
  ;(app as NestExpressApplication).set('trust proxy', config.TRUST_PROXY_HOPS)
  app.use(httpLogging(logger))
  app.use(helmet())
  app.use(cookieParser())
  // CORS is for GraphQL and the Sentry tunnel. Health, webhooks and every other path stay without it.
  app.use(graphqlCors(config.CORS_ORIGINS))
  // The web SDK posts `application/x-sentry-envelope`, which the JSON parser does not read.
  app.use('/monitoring', express.raw({ type: ['application/x-sentry-envelope', 'text/plain'], limit: '6mb' }))
  // Subgraphs are composed in-process; only the gateway at /graphql is public.
  app.use(SUBGRAPH_PATH_PREFIX, (_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).end()
  })
}
