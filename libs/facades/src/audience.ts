/** Product-email audience (Resend). Implemented by communication; users enqueues the sync. */
export const AUDIENCE = Symbol('AUDIENCE')

export interface AudienceContact {
  email: string
  firstName: string
  lastName: string
  unsubscribed: boolean
}

export interface Audience {
  /** False when RESEND_API_KEY or RESEND_AUDIENCE_ID is unset. Calls then do nothing. */
  readonly enabled: boolean
  upsert(contact: AudienceContact): Promise<void>
  /** Missing contacts are a success. */
  remove(email: string): Promise<void>
  setUnsubscribed(email: string, unsubscribed: boolean): Promise<void>
}
