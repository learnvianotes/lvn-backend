import { Resend } from 'resend'

/** The slice of the Resend SDK this client uses. Tests pass a fake. */
export interface ResendContactsApi {
  create(input: { audienceId: string; email: string; firstName: string; lastName: string; unsubscribed: boolean }): Promise<ResendResult<{ id: string }>>
  update(input: { audienceId: string; email: string; firstName?: string; lastName?: string; unsubscribed?: boolean }): Promise<ResendResult<{ id: string }>>
  remove(input: { audienceId: string; email: string }): Promise<ResendResult<{ deleted: boolean }>>
}

export interface ResendResult<T> {
  data: T | null
  error: { message: string; statusCode: number | null; name: string } | null
}

export interface AudienceContactInput {
  email: string
  firstName: string
  lastName: string
  unsubscribed: boolean
}

/**
 * Upserts one contact in a Resend audience. The SDK still accepts `audienceId` and calls
 * `/audiences/{id}/contacts`. Create, and on "already exists" update the same email. Remove treats a missing
 * contact as done. Nothing here logs an address.
 */
export class ResendAudienceClient {
  constructor(
    private readonly audienceId: string,
    private readonly contacts: ResendContactsApi,
  ) {}

  static fromApiKey(apiKey: string, audienceId: string): ResendAudienceClient {
    return new ResendAudienceClient(audienceId, new Resend(apiKey).contacts)
  }

  async upsert(contact: AudienceContactInput): Promise<void> {
    const created = await this.contacts.create({ audienceId: this.audienceId, ...contact })
    if (!created.error) return
    if (!alreadyExists(created.error)) throw refused('create', created.error)
    const updated = await this.contacts.update({ audienceId: this.audienceId, ...contact })
    if (updated.error) throw refused('update', updated.error)
  }

  async remove(email: string): Promise<void> {
    const removed = await this.contacts.remove({ audienceId: this.audienceId, email })
    if (removed.error && !missing(removed.error)) throw refused('remove', removed.error)
  }

  async setUnsubscribed(email: string, unsubscribed: boolean): Promise<void> {
    const updated = await this.contacts.update({ audienceId: this.audienceId, email, unsubscribed })
    if (updated.error && !missing(updated.error)) throw refused('update', updated.error)
  }
}

function alreadyExists(error: { statusCode: number | null; message: string }): boolean {
  return error.statusCode === 409 || /already exists/i.test(error.message)
}

function missing(error: { statusCode: number | null; name: string }): boolean {
  return error.statusCode === 404 || error.name === 'not_found'
}

/** Status only. Resend's message can repeat the address. */
function refused(op: string, error: { statusCode: number | null; name: string }): Error {
  return new Error(`Resend audience ${op} failed: ${error.name} (${error.statusCode ?? 'no status'})`)
}
