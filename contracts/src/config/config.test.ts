import { apiConfigSchema, ConfigError, loadConfig } from './index'

const valid = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://lvn:lvn@localhost:5432/lvn',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:3000, https://sandbox.learnvianotes.com',
}

describe('loadConfig', () => {
  it('parses and applies defaults', () => {
    const cfg = loadConfig(apiConfigSchema, valid)
    expect(cfg.API_PORT).toBe(4000)
    expect(cfg.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://sandbox.learnvianotes.com'])
  })

  it('fails fast, naming every bad variable but never its value', () => {
    const run = () => loadConfig(apiConfigSchema, { ...valid, APP_ENV: 'staging', DATABASE_URL: 'mysql://secret@x/db' })
    expect(run).toThrow(ConfigError)
    expect(run).toThrow(/APP_ENV/)
    expect(run).toThrow(/DATABASE_URL/)
    expect(run).not.toThrow(/secret/)
  })
})
