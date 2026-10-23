import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseStudyPage, renderStudyPage } from '../../src/domain/study-page'

const root = path.resolve(__dirname, '../../../..')
const content = path.join(root, 'content/study')
const ANALYSIS = 'e5ba2811-3113-7344-b6f5-0ec9a0e57cda'

function pages(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'README.md') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...pages(full))
    else if (name.endsWith('.md')) out.push(full)
  }
  return out
}

/** The catalogue is Markdown, synced by slug and key. It must not come back as a migration that deletes rows. */
describe('study note pages', () => {
  const files = pages(content)
  const sync = readFileSync(path.join(root, 'contexts/notes/src/application/study-content-sync.ts'), 'utf8')
  const publisher = readFileSync(path.join(root, 'contexts/users/src/domain/study-publisher.ts'), 'utf8')

  it('has one page per seeded note, and the page round-trips', () => {
    expect(files).toHaveLength(907)
    const ids = new Set<string>()
    const keys = new Set<string>()
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const page = parseStudyPage(source, path.relative(content, file))
      const [subject, topic, name] = path.relative(content, file).split(path.sep)
      expect(page.subject).toBe(subject)
      expect(page.topic).toBe(topic)
      expect(name).toMatch(/^\d{2}-[a-z0-9-]+\.md$/)
      expect(ids.has(page.id)).toBe(false)
      expect(keys.has(page.key)).toBe(false)
      ids.add(page.id)
      keys.add(page.key)
      const again = parseStudyPage(renderStudyPage(page), file)
      expect(again).toMatchObject({ id: page.id, key: page.key, title: page.title, slug: page.slug, subject, topic })
      expect(again.cards).toEqual(page.cards)
    }
    expect(ids.has(ANALYSIS)).toBe(true)
    expect(keys.has('topic:dsa-basics/analysis')).toBe(true)
  })

  it('looks topics up by slug and does not wipe rows or invent credentials', () => {
    expect(readdirSync(path.join(root, 'prisma/migrations')).some((name) => name.includes('study_notes'))).toBe(false)
    expect(sync).toContain('row.subject.slug')
    expect(sync).not.toContain('01a118cf-4802-7dcd-94da-1b32ee2f97fe')
    expect(sync).not.toMatch(/\bTRUNCATE\b/)
    expect(sync).not.toMatch(/user\.update\(/)
    expect(sync).not.toMatch(/note\.delete\(/)
    expect(sync).toContain('noteTopic.deleteMany')
    expect(sync).toContain("const STUDY_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'")
    expect(sync).toContain("const STUDY_PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'")
    expect(sync).toContain("const STUDY_PUBLISHER_HANDLE = 'learnvianotes'")
    expect(sync).toContain('Study content sync stopped')
    expect(sync).not.toContain('notes@learnvianotes.in')
    expect(publisher).toContain("export const STUDY_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'")
    expect(publisher).toContain("export const STUDY_PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'")
    expect(sync).not.toContain('1990-01-01')
    expect(sync).not.toContain('verificationMethod:')
    expect(sync).not.toContain('dateOfBirth:')
  })

  it('keeps the retired generator from rewriting migrations', () => {
    const script = path.join(root, 'scripts/generate-study-seed.mjs')
    const source = readFileSync(script, 'utf8')
    expect(source).not.toContain("from 'node:fs'")
    expect(source).not.toContain('rmSync')
    expect(source).not.toContain('writeFileSync')
    const before = readdirSync(path.join(root, 'prisma/migrations')).sort()
    const ran = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' })
    expect(ran.status).toBe(1)
    expect(ran.stderr).toMatch(/retired/)
    expect(readdirSync(path.join(root, 'prisma/migrations')).sort()).toEqual(before)
  })
})
