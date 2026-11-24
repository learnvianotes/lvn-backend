import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

function platformAdminFields(dir: string): string[] {
  const names: string[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.graphql')) continue
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const block of text.split(/\n(?=(?:extend )?type )/)) {
      if (!/^(?:extend )?type (?:Query|Mutation)\b/.test(block)) continue
      const re = /(?:"""([\s\S]*?)"""|"((?:\\.|[^"\\])*)")\s*(?:@[A-Za-z0-9_]+[^\n]*\n\s*)*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*:/g
      for (const match of block.matchAll(re)) if (isAdminOperation(match[1] ?? match[2] ?? '')) names.push(match[3]!)
    }
  }
  return names
}

function isAdminOperation(description: string): boolean {
  return /platform admins?[.:]|platform admins only|platform admins anywhere|\(PLATFORM_ADMIN\)|^platform admins?\b|only platform admins/i.test(description.trim())
}

function requireMfaFields(dir: string): Set<string> {
  const fields = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.resolver.ts')) continue
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const chunk of text.split(/@Resolver\b/).slice(1)) {
      const classLevel = /@RequireMfa\(/.test(chunk.slice(0, chunk.indexOf('{')))
      const re = /@(?:Query|Mutation)\('([^']+)'\)([\s\S]*?)(?=@(?:Query|Mutation|ResolveField)\(|$)/g
      for (const match of chunk.matchAll(re)) if (classLevel || /@RequireMfa\(/.test(match[2] ?? '')) fields.add(match[1]!)
    }
  }
  return fields
}

const graphql = path.join(__dirname, '../../src/graphql')

describe('core admin operations require MFA', () => {
  const fields = platformAdminFields(graphql)
  const marked = requireMfaFields(graphql)

  it('finds contests and moderation', () => {
    expect(fields).toEqual(expect.arrayContaining(['adminContests', 'saveContest', 'publishContest', 'deleteContest', 'moderateContent']))
  })

  it.each(fields)('%s is marked @RequireMfa()', (field) => {
    expect(marked.has(field)).toBe(true)
  })
})
