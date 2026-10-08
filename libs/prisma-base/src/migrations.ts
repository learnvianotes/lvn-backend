import { readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * The newest migration shipped with this build (`prisma/migrations/<timestamp>_<name>`), read from the repository
 * layout that both the source tree and the container image keep. Null when the folder is not there.
 */
export function shippedMigration(dir = path.resolve(__dirname, '../../../prisma/migrations')): string | null {
  try {
    const names = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name)).map((d) => d.name)
    return names.sort().at(-1) ?? null
  } catch {
    return null
  }
}
