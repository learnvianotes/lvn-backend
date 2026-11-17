import { Inject, Injectable, Optional } from '@nestjs/common'
import type { Audience, AudienceContact } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { COMMUNICATION_CONFIG, type CommunicationConfig } from '../communication.config'
import { ResendAudienceClient } from './resend-contacts'

/** Tests pass a client here. Unset, the service builds one from the API key and audience id. */
export const RESEND_CONTACTS = Symbol('RESEND_CONTACTS')

/**
 * The AUDIENCE facade. Off unless both the API key and the audience id are set, so local mail (Mailpit) does not
 * need a Resend audience. A missing contact is not an error: the next sync creates it with the stored preference.
 */
@Injectable()
export class AudienceService implements Audience {
  private readonly contacts: ResendAudienceClient | null

  constructor(
    @Inject(COMMUNICATION_CONFIG) config: CommunicationConfig,
    private readonly db: PrismaService,
    @Optional() @Inject(RESEND_CONTACTS) contacts?: ResendAudienceClient | null,
  ) {
    this.contacts = contacts === undefined ? (config.resendApiKey && config.audienceId ? ResendAudienceClient.fromApiKey(config.resendApiKey, config.audienceId) : null) : contacts
  }

  get enabled(): boolean {
    return this.contacts !== null
  }

  async upsert(contact: AudienceContact): Promise<void> {
    await this.contacts?.upsert(contact)
  }

  async remove(email: string): Promise<void> {
    await this.contacts?.remove(email)
  }

  async setUnsubscribed(email: string, unsubscribed: boolean): Promise<void> {
    await this.contacts?.setUnsubscribed(email, unsubscribed)
  }

  /** The settings toggle and the MARKETING unsubscribe link. Stores nothing; the preference is already saved. */
  async applyProductEmails(userId: string, productEmails: boolean): Promise<void> {
    if (!this.contacts) return
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { email: true, deletedAt: true } })
    if (!user || user.deletedAt) return
    await this.contacts.setUnsubscribed(user.email, !productEmails)
  }
}
