import { apiConfigSchema, ConfigError, loadConfig, mobileConfigSchema, workerConfigSchema } from '../../../src/config'

const PRIVATE = '-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----'
const PUBLIC = '-----BEGIN PUBLIC KEY-----\\nMIIB\\n-----END PUBLIC KEY-----'

const storageAndMail = {
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'lvn-files',
  S3_RESTRICTED_BUCKET: 'lvn-restricted',
  MAIL_FROM: 'LearnViaNotes <no-reply@learnvianotes.in>',
  MAIL_TRANSPORT: 'smtp',
  SMTP_URL: 'smtp://localhost:51025',
}

const valid = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://lvn:lvn@localhost:5432/lvn',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000, https://sandbox.learnvianotes.in',
  ...storageAndMail,
  JWT_PRIVATE_KEY: PRIVATE,
  JWT_PUBLIC_KEY: PUBLIC,
  JWT_ISSUER: 'http://localhost:4000',
  WEB_URL: 'http://localhost:3000',
  CODE_HMAC_SECRET: 'x'.repeat(32),
}

describe('loadConfig', () => {
  it('parses and applies defaults', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg.API_PORT).toBe(4000)
    expect(cfg.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://sandbox.learnvianotes.in'])
  })

  it('fails fast, naming every bad variable but never its value', () => {
    const run = () => loadConfig(apiConfigSchema, { ...valid, APP_ENV: 'staging', DATABASE_URL: 'mysql://secret@x/db' })
    expect(run).toThrow(ConfigError)
    expect(run).toThrow(/APP_ENV/)
    expect(run).toThrow(/DATABASE_URL/)
    expect(run).not.toThrow(/secret/)
  })
})

describe('apiConfigSchema (Phase 1)', () => {
  it('turns escaped newlines in PEM keys into real ones', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg.JWT_PRIVATE_KEY).toBe('-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----')
    expect(cfg.JWT_PUBLIC_KEY.split('\n')).toHaveLength(3)
  })

  it('refuses a key of the wrong kind', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, JWT_PUBLIC_KEY: PRIVATE })).toThrow(/JWT_PUBLIC_KEY/)
  })

  it('needs the credentials of the chosen mail transport', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, SMTP_URL: undefined })).toThrow(/SMTP_URL/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, MAIL_TRANSPORT: 'resend' })).toThrow(/RESEND_API_KEY/)
    expect(loadConfig(apiConfigSchema, { ...valid, MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_123' }).MAIL_TRANSPORT).toBe('resend')
  })

  it('parses the path-style flag and leaves sign-in providers off by default', () => {
    const cfg = loadConfig(apiConfigSchema, { ...valid, S3_FORCE_PATH_STYLE: 'true' })
    expect(cfg.S3_FORCE_PATH_STYLE).toBe(true)
    expect(loadConfig(apiConfigSchema, valid).S3_FORCE_PATH_STYLE).toBe(false)
    expect(cfg.FIREBASE_PROJECT_ID).toBeUndefined()
    expect(cfg.GITHUB_CLIENT_ID).toBeUndefined()
  })

  it('defaults the digital consent age to 18 (DPDP) and bounds it', () => {
    expect(loadConfig(apiConfigSchema, valid).DIGITAL_CONSENT_AGE).toBe(18)
    expect(loadConfig(apiConfigSchema, { ...valid, DIGITAL_CONSENT_AGE: '16' }).DIGITAL_CONSENT_AGE).toBe(16)
    expect(() => loadConfig(apiConfigSchema, { ...valid, DIGITAL_CONSENT_AGE: '10' })).toThrow(/DIGITAL_CONSENT_AGE/)
  })

  it('needs endpoints and redirect URIs for a provider that is switched on', () => {
    const github = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }
    expect(() => loadConfig(apiConfigSchema, { ...valid, ...github })).toThrow(/GITHUB_OAUTH_URL[\s\S]*GITHUB_API_URL[\s\S]*OAUTH_REDIRECT_URIS/)
    const cfg = loadConfig(apiConfigSchema, {
      ...valid,
      ...github,
      GITHUB_OAUTH_URL: 'https://github.com',
      GITHUB_API_URL: 'https://api.github.com',
      OAUTH_REDIRECT_URIS: 'http://localhost:3000/oauth/callback, lvn://oauth',
    })
    expect(cfg.OAUTH_REDIRECT_URIS).toEqual(['http://localhost:3000/oauth/callback', 'lvn://oauth'])
    expect(loadConfig(apiConfigSchema, valid).OAUTH_REDIRECT_URIS).toEqual([])
  })

  it('requires a long code secret', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, CODE_HMAC_SECRET: 'short' })).toThrow(/CODE_HMAC_SECRET/)
  })
})

describe('workerConfigSchema', () => {
  it('reads the API variables plus its own', () => {
    const cfg = loadConfig(workerConfigSchema, { ...valid, LEGACY_FIREBASE_PROJECT_ID: 'learnvianotes-old' })
    expect(cfg.WORKER_HEALTH_PORT).toBe(4001)
    expect(cfg.S3_BUCKET).toBe('lvn-files')
    expect(cfg.LEGACY_FIREBASE_PROJECT_ID).toBe('learnvianotes-old')
    expect(() => loadConfig(workerConfigSchema, { ...valid, S3_BUCKET: undefined })).toThrow(/S3_BUCKET/)
  })
})

describe('mobileConfigSchema', () => {
  it('requires the environment and the web origin', () => {
    expect(loadConfig(mobileConfigSchema, { EXPO_PUBLIC_APP_ENV: 'sandbox', EXPO_PUBLIC_WEB_URL: 'https://sandbox.learnvianotes.in' }).EXPO_PUBLIC_APP_ENV).toBe('sandbox')
    expect(() => loadConfig(mobileConfigSchema, { EXPO_PUBLIC_APP_ENV: 'sandbox' })).toThrow(/EXPO_PUBLIC_WEB_URL/)
  })
})
