import { Injectable } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { TERMS_VERSION } from '../domain/rules'

const DOCUMENTS = ['TERMS', 'PRIVACY', 'PUBLIC_CONTENT_LICENCE'] as const

/**
 * Acceptance of the Terms, the Privacy Policy and the public-content licence (§15.2): recorded with the version, and
 * asked for again when TERMS_VERSION changes ("re-prompt on material change").
 */
@Injectable()
export class ConsentService {
  constructor(private readonly db: PrismaService) {}

  /** Whether the person's latest acceptance is of the current version (all three documents are accepted together). */
  async accepted(userId: string): Promise<boolean> {
    const latest = await this.db.consentRecord.findFirst({ where: { userId, kind: 'TERMS' }, orderBy: { acceptedAt: 'desc' } })
    return latest?.version === TERMS_VERSION
  }

  async accept(userId: string, version: string): Promise<void> {
    if (version !== TERMS_VERSION) throw Errors.validation('These are not the current terms. Reload the page and read them again.', ['input', 'version'])
    if (await this.accepted(userId)) return
    await this.db.consentRecord.createMany({ data: DOCUMENTS.map((kind) => ({ id: newId(), userId, kind, version })) })
  }
}
