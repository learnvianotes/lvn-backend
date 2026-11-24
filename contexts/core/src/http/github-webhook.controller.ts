import { Controller, Headers, HttpCode, HttpException, Post, Req, Res } from '@nestjs/common'
import { AppError, ErrorCode } from '@lvn-backend/errors'
import { GitHubAppService } from '../application/github-app.service'

const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, VALIDATION: 400, NOT_FOUND: 404 }

/**
 * GitHub App deliveries (ADR-0078): checked by signature over the raw body, stored once and answered at once (GitHub
 * waits 10 seconds); the worker does the rest. 404 while the App is not configured.
 */
@Controller('webhooks')
export class GitHubWebhookController {
  constructor(private readonly app: GitHubAppService) {}

  @Post('github')
  @HttpCode(202)
  async receive(
    @Req() req: { rawBody?: Buffer; ip?: string; originalUrl?: string; url?: string },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): Promise<{ ok: true; duplicate?: true }> {
    try {
      const path = (req.originalUrl ?? req.url ?? '/webhooks/github').split('?')[0] || '/webhooks/github'
      return (await this.app.receive(headers, req.rawBody, req.ip, path)) === 'duplicate' ? { ok: true, duplicate: true } : { ok: true }
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCode.RATE_LIMITED) {
        res.setHeader('Retry-After', String(err.retryAfter ?? 1))
        throw new HttpException({ error: err.message }, 429)
      }
      if (err instanceof AppError) throw new HttpException({ error: err.message }, STATUS[err.code] ?? 500)
      throw err
    }
  }
}
