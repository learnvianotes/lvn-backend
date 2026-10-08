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
  github?: { clientId: string; clientSecret: string; oauthUrl: string; apiUrl: string }
  linkedin?: { clientId: string; clientSecret: string; oauthUrl: string; apiUrl: string }
  /** Redirect URIs registered with GitHub and LinkedIn; oauthExchange accepts no other */
  oauthRedirectUris: string[]
}

export const USERS_CONFIG = Symbol('USERS_CONFIG')
