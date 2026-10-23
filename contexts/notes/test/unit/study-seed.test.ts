import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const migrations = path.resolve(__dirname, '../../../../prisma/migrations')

/** SQL with comments and string literals removed, so note bodies that mention DELETE are not commands. */
function commands(sql: string): string {
  let out = ''
  let i = 0
  let inString = false
  while (i < sql.length) {
    const c = sql[i]
    if (!inString && c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1
      continue
    }
    if (!inString && c === "'") {
      inString = true
      i += 1
      continue
    }
    if (inString && c === "'") {
      if (sql[i + 1] === "'") {
        i += 2
        continue
      }
      inString = false
      i += 1
      continue
    }
    if (!inString) out += c
    i += 1
  }
  return out
}

/**
 * The study notes are a migration, not a manual import (ADR-0098). This fails when that migration stops inserting
 * the catalogue and the 907 public notes, or starts deleting rows.
 */
describe('study note migrations', () => {
  const names = readdirSync(migrations)
    .filter((name) => name.includes('study_notes'))
    .sort()
  const sql = names.map((name) => readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8')).join('\n')
  const issued = commands(sql)

  it('ships the catalogue and one insert per study note', () => {
    expect(names[0]).toBe('20261109090000_study_notes_catalogue')
    expect(names).toHaveLength(11)
    expect(sql.match(/INSERT INTO "notes"\."Subject"/g)).toHaveLength(1)
    expect(sql.match(/INSERT INTO "notes"\."Note"/g)).toHaveLength(907)
    expect(sql.match(/SET "publishedVersionId" = /g)).toHaveLength(907)
    expect(sql).toContain("'dsa-basics'")
    expect(sql).toContain("'019a118c-f480-7000-8000-000000000001'")
    expect(sql).toContain('ON CONFLICT DO NOTHING')
  })

  it('only inserts, and publishes a note that is still the seed stub', () => {
    expect(issued).not.toMatch(/\bTRUNCATE\b/)
    expect(issued).not.toMatch(/\bDELETE\b/)
    expect(issued).not.toMatch(/\bDROP\b/)
    expect(issued).not.toMatch(/UPDATE "users"/)
    expect(issued.match(/UPDATE "notes"\."Note"/g)).toHaveLength(907)
  })
})
