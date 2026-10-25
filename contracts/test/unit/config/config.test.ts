import { apiConfigSchema, ConfigError, loadConfig, mobileConfigSchema, webConfigSchema, workerConfigSchema } from '../../../src/config'

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

  it('sends through SES with the task role, needing only the region', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, MAIL_TRANSPORT: 'ses' })).toThrow(/SES_REGION/)
    expect(loadConfig(apiConfigSchema, { ...valid, MAIL_TRANSPORT: 'ses', SES_REGION: 'ap-south-1' }).SES_REGION).toBe('ap-south-1')
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
    expect(loadConfig(apiConfigSchema, valid).ACCOUNT_MINIMUM_AGE).toBe(18)
    expect(loadConfig(apiConfigSchema, { ...valid, ACCOUNT_MINIMUM_AGE: '0' }).ACCOUNT_MINIMUM_AGE).toBe(0)
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

  it('searches on Postgres by default; Typesense needs its address and key together (ADR-0055)', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg.SEARCH_PROVIDER).toBe('postgres')
    expect(cfg.TYPESENSE_COLLECTION_PREFIX).toBe('lvn_')
    expect(cfg.SEARCH_TIMEOUT_MS).toBe(800)
    expect(cfg.SEARCH_HYBRID).toBe(false)
    expect(loadConfig(apiConfigSchema, { ...valid, SEARCH_HYBRID: 'true' }).SEARCH_HYBRID).toBe(true)
    expect(() => loadConfig(apiConfigSchema, { ...valid, SEARCH_PROVIDER: 'typesense' })).toThrow(/TYPESENSE_URL/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, TYPESENSE_URL: 'http://typesense:8108' })).toThrow(/TYPESENSE_API_KEY/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, TYPESENSE_URL: 'typesense:8108', TYPESENSE_API_KEY: 'k'.repeat(32) })).toThrow(/TYPESENSE_URL/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, TYPESENSE_COLLECTION_PREFIX: 'LVN-' })).toThrow(/TYPESENSE_COLLECTION_PREFIX/)
    const typesense = loadConfig(workerConfigSchema, { ...valid, SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: 'http://typesense:8108', TYPESENSE_API_KEY: 'k'.repeat(32), SEARCH_TIMEOUT_MS: '300' })
    expect(typesense).toMatchObject({ SEARCH_PROVIDER: 'typesense', TYPESENSE_URL: 'http://typesense:8108', SEARCH_TIMEOUT_MS: 300 })
  })
})

describe('AI settings (ADR-0058)', () => {
  it('leaves AI off by default (daily quotas are the plan’s, ADR-0024)', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg).toMatchObject({ AI_PROVIDER: 'none', AI_TIMEOUT_MS: 120_000 })
    expect(cfg.AI_MONTHLY_BUDGET_MICRO_USD).toBeUndefined()
  })
  it('needs the address and the models of a local model', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, AI_PROVIDER: 'ollama' })).toThrow(/OLLAMA_URL[\s\S]*AI_CHAT_MODEL[\s\S]*AI_EMBED_MODEL/)
    const cfg = loadConfig(workerConfigSchema, { ...valid, AI_PROVIDER: 'ollama', OLLAMA_URL: 'http://10.0.2.2:11434', AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma', AI_MONTHLY_BUDGET_MICRO_USD: '50000000' })
    expect(cfg).toMatchObject({ AI_PROVIDER: 'ollama', AI_CHAT_MODEL: 'gemma4', AI_MONTHLY_BUDGET_MICRO_USD: 50_000_000 })
  })

  it('lets tests allow named hosts for the safe fetcher, never production (ADR-0074)', () => {
    expect(loadConfig(apiConfigSchema, { ...valid, SAFE_FETCH_ALLOW_HOSTS: '127.0.0.1, Stand-In ' }).SAFE_FETCH_ALLOW_HOSTS).toEqual(['127.0.0.1', 'stand-in'])
    expect(loadConfig(apiConfigSchema, valid).SAFE_FETCH_ALLOW_HOSTS).toEqual([])
    expect(() => loadConfig(apiConfigSchema, { ...valid, APP_ENV: 'production', SAFE_FETCH_ALLOW_HOSTS: '127.0.0.1' })).toThrow(/SAFE_FETCH_ALLOW_HOSTS/)
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
  const mobile = { EXPO_PUBLIC_APP_ENV: 'sandbox', EXPO_PUBLIC_WEB_URL: 'https://sandbox.learnvianotes.in', EXPO_PUBLIC_API_URL: 'https://api.sandbox.learnvianotes.in/graphql' }

  it('requires the environment, the web origin and the API', () => {
    expect(loadConfig(mobileConfigSchema, mobile).EXPO_PUBLIC_APP_ENV).toBe('sandbox')
    expect(() => loadConfig(mobileConfigSchema, { EXPO_PUBLIC_APP_ENV: 'sandbox' })).toThrow(/EXPO_PUBLIC_WEB_URL/)
    expect(() => loadConfig(mobileConfigSchema, { ...mobile, EXPO_PUBLIC_API_URL: undefined })).toThrow(/EXPO_PUBLIC_API_URL/)
  })

  it('takes Google sign-in (Firebase) as optional', () => {
    const c = loadConfig(mobileConfigSchema, { ...mobile, EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'lvn-prod', EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123-abc.apps.googleusercontent.com' })
    expect(c).toMatchObject({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'lvn-prod', EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '123-abc.apps.googleusercontent.com' })
    expect(loadConfig(mobileConfigSchema, mobile).EXPO_PUBLIC_FIREBASE_API_KEY).toBeUndefined()
  })

  it('takes GitHub sign-in and Sentry as optional', () => {
    const c = loadConfig(mobileConfigSchema, { ...mobile, EXPO_PUBLIC_GITHUB_CLIENT_ID: 'Iv1.abc', EXPO_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2' })
    expect(c.EXPO_PUBLIC_GITHUB_CLIENT_ID).toBe('Iv1.abc')
    expect(() => loadConfig(mobileConfigSchema, { ...mobile, EXPO_PUBLIC_SENTRY_DSN: 'not a url' })).toThrow(/EXPO_PUBLIC_SENTRY_DSN/)
  })
})

describe('webConfigSchema', () => {
  it('requires the site origin and the API; providers, feedback and Sentry are optional', () => {
    const c = loadConfig(webConfigSchema, { NEXT_PUBLIC_SITE_URL: 'https://www.learnvianotes.in', NEXT_PUBLIC_API_URL: 'https://api.learnvianotes.in/graphql', NEXT_PUBLIC_FEEDBACK_URL: '' })
    expect(c.NEXT_PUBLIC_APP_ENV).toBe('development')
    expect(() => loadConfig(webConfigSchema, { NEXT_PUBLIC_SITE_URL: 'https://www.learnvianotes.in' })).toThrow(/NEXT_PUBLIC_API_URL/)
  })

  it('takes only a GA4 measurement id for Google Analytics (ADR-0092)', () => {
    const base = { NEXT_PUBLIC_SITE_URL: 'https://www.learnvianotes.in', NEXT_PUBLIC_API_URL: 'https://api.learnvianotes.in/graphql' }
    expect(loadConfig(webConfigSchema, { ...base, NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-AB12CD34' }).NEXT_PUBLIC_GA_MEASUREMENT_ID).toBe('G-AB12CD34')
    expect(() => loadConfig(webConfigSchema, { ...base, NEXT_PUBLIC_GA_MEASUREMENT_ID: 'UA-1234-1' })).toThrow(/NEXT_PUBLIC_GA_MEASUREMENT_ID/)
  })
})

describe('telemetry', () => {
  it('turns OpenTelemetry and Sentry on only with well-formed URLs', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, OTEL_EXPORTER_OTLP_ENDPOINT: 'collector:4318' })).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT/)
    const c = loadConfig(apiConfigSchema, { ...valid, OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318', SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2', RELEASE: 'abc1234' })
    expect(c).toMatchObject({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318', RELEASE: 'abc1234' })
  })
})

describe('upload scanning (ADR-0102)', () => {
  const secret = 's'.repeat(32)
  it('leaves scanning off unless SCAN_MODE or CLAMAV_URL says otherwise', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg.SCAN_MODE).toBeUndefined()
    expect(cfg.SCANNER_TIMEOUT_MS).toBe(180_000)
    expect(loadConfig(apiConfigSchema, { ...valid, CLAMAV_URL: 'tcp://127.0.0.1:3310' }).CLAMAV_URL).toBe('tcp://127.0.0.1:3310')
  })

  it('requires the service address and secret for remote mode, and a private address outside development', () => {
    expect(() => loadConfig(apiConfigSchema, { ...valid, SCAN_MODE: 'remote' })).toThrow(/SCANNER_URL[\s\S]*SCANNER_SECRET/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, SCAN_MODE: 'local' })).toThrow(/CLAMAV_URL/)
    expect(() => loadConfig(apiConfigSchema, { ...valid, SCANNER_URL: 'http://10.0.0.5:8080' })).toThrow(/SCAN_MODE/)
    const remote = { ...valid, SCAN_MODE: 'remote', SCANNER_URL: 'http://127.0.0.1:8080', SCANNER_SECRET: secret }
    expect(loadConfig(apiConfigSchema, remote).SCANNER_URL).toBe('http://127.0.0.1:8080')
    expect(() => loadConfig(apiConfigSchema, { ...remote, APP_ENV: 'sandbox' })).toThrow(/SCANNER_URL/)
    expect(() => loadConfig(apiConfigSchema, { ...remote, APP_ENV: 'production', SCANNER_URL: 'https://scan.example.com' })).toThrow(/SCANNER_URL/)
    expect(loadConfig(apiConfigSchema, { ...remote, APP_ENV: 'production', SCANNER_URL: 'http://10.0.1.8:8080' }).SCANNER_URL).toBe('http://10.0.1.8:8080')
  })
})

describe('TRUST_PROXY_HOPS', () => {
  it('defaults to trusting no proxy and accepts a small number of hops only', () => {
    expect(loadConfig(apiConfigSchema, valid).TRUST_PROXY_HOPS).toBe(0)
    expect(loadConfig(apiConfigSchema, { ...valid, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2)
    for (const bad of ['-1', '6', 'true', '1.5']) expect(() => loadConfig(apiConfigSchema, { ...valid, TRUST_PROXY_HOPS: bad })).toThrow(/TRUST_PROXY_HOPS/)
  })
})
