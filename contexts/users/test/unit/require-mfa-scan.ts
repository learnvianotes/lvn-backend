import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** GraphQL fields whose description names a platform admin. */
export function platformAdminFields(dir: string): string[] {
  const names: string[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.graphql')) continue
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const block of text.split(/\n(?=(?:extend )?type )/)) {
      if (!/^(?:extend )?type (?:Query|Mutation)\b/.test(block)) continue
      const re = /(?:"""([\s\S]*?)"""|"((?:\\.|[^"\\])*)")\s*(?:@[A-Za-z0-9_]+[^\n]*\n\s*)*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*:/g
      for (const match of block.matchAll(re)) {
        const description = match[1] ?? match[2] ?? ''
        if (isAdminOperation(description)) names.push(match[3]!)
      }
    }
  }
  return names
}

/** The description is telling a platform admin they may call it, not merely mentioning them. */
function isAdminOperation(description: string): boolean {
  return /platform admins?[.:]|platform admins only|platform admins anywhere|\(PLATFORM_ADMIN\)|^platform admins?\b|only platform admins/i.test(description.trim())
}

/**
 * Field names whose resolver method, or whose resolver class, is marked `@RequireMfa()`.
 * The marker is what makes the guard run and what makes an admin mutation write an audit row.
 */
export function requireMfaFields(dir: string): Set<string> {
  const fields = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.resolver.ts')) continue
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const chunk of text.split(/@Resolver\b/).slice(1)) {
      const head = chunk.slice(0, chunk.indexOf('{'))
      const classLevel = /@RequireMfa\(/.test(head)
      const re = /@(?:Query|Mutation)\('([^']+)'\)([\s\S]*?)(?=@(?:Query|Mutation|ResolveField)\(|$)/g
      for (const match of chunk.matchAll(re)) {
        if (classLevel || /@RequireMfa\(/.test(match[2] ?? '')) fields.add(match[1]!)
      }
    }
  }
  return fields
}
