import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { shippedMigration } from '../../src/migrations'

describe('shippedMigration', () => {
  it('finds the newest migration this repository ships', () => {
    expect(shippedMigration()).toMatch(/^\d{14}_[a-z0-9_]+$/)
  })

  it('orders by timestamp and ignores anything that is not a migration folder', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'migrations-'))
    for (const name of ['20261007232753_users', '20261008020000_core', 'migration_lock.toml', 'notes']) mkdirSync(path.join(dir, name))
    expect(shippedMigration(dir)).toBe('20261008020000_core')
  })

  it('is null without a migrations folder', () => {
    expect(shippedMigration(path.join(tmpdir(), 'no-such-folder'))).toBeNull()
  })
})
