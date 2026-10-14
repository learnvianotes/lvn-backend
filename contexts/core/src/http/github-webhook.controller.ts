import { Controller, Headers, HttpCode, HttpException, Post, Req } from '@nestjs/common'
import { AppError } from '@lvn-backend/errors'
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
  async receive(@Req() req: { rawBody?: Buffer }, @Headers() headers: Record<string, string | string[] | undefined>): Promise<{ ok: true; duplicate?: true }> {
    try {
      return (await this.app.receive(headers, req.rawBody)) === 'duplicate' ? { ok: true, duplicate: true } : { ok: true }
    } catch (err) {
      if (err instanceof AppError) throw new HttpException({ error: err.message }, STATUS[err.code] ?? 500)
      throw err
    }
  }
}
