/** What the users context needs from the API configuration; apps/api maps ApiConfig onto it. */
export interface UsersConfig {
  jwtPrivateKey: string
  jwtIssuer: string
  tokenAudience: string
  webUrl: string
  codeHmacSecret: string
  digitalConsentAge: number
  passwordBreachApiUrl?: string
  firebaseProjectId?: string
  github?: { clientId: string; clientSecret: string }
  linkedin?: { clientId: string; clientSecret: string }
}

export const USERS_CONFIG = Symbol('USERS_CONFIG')
