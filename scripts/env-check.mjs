#!/usr/bin/env node
/**
 * Spec §16.1: CI fails if a variable is read but not documented. Checks that every variable of the API and worker
 * config schemas, and every `process.env.X` read in apps/, contexts/ and libs/ sources, appears in .env.example
 * (set or commented out) and in docs/architecture/env.md. Run after `pnpm build` (it reads contracts/dist).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const { apiConfigSchema, workerConfigSchema } = require(path.join(root, 'contracts/dist/config/index.js'))

/** Read by tooling, not by the apps' configuration. */
const NOT_CONFIG = new Set(['NODE_ENV', 'GOOGLE_APPLICATION_CREDENTIALS', 'JEST_WORKER_ID'])

const keys = (schema) => Object.keys(schema.shape ?? schema.def?.in?.shape ?? {})
const fromSchemas = new Set([...keys(apiConfigSchema), ...keys(workerConfigSchema)])
if (fromSchemas.size < 10) throw new Error('Could not read the config schemas from contracts/dist — run pnpm build first')

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (['node_modules', 'dist', 'generated', 'test', 'coverage'].includes(name)) return []
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
const fromCode = new Map()
for (const top of ['apps', 'contexts', 'libs']) {
  for (const file of walk(path.join(root, top))) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (!NOT_CONFIG.has(name)) fromCode.set(name, path.relative(root, file))
    }
  }
}

const example = readFileSync(path.join(root, '.env.example'), 'utf8')
const inExample = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]))
const docs = readFileSync(path.join(root, 'docs/architecture/env.md'), 'utf8')
const inDocs = new Set([...docs.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((m) => m[1]))

const problems = []
for (const name of fromSchemas) {
  if (!inExample.has(name)) problems.push(`${name}: in the config schema but not in .env.example`)
  if (!inDocs.has(name)) problems.push(`${name}: in the config schema but not in docs/architecture/env.md`)
}
for (const [name, file] of fromCode) {
  if (!fromSchemas.has(name) && !inExample.has(name)) problems.push(`${name}: read in ${file} but not in .env.example`)
}
if (problems.length) {
  console.error(`Environment variables out of step (spec §16.1):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`env-check: ${fromSchemas.size} config variables and ${fromCode.size} direct reads documented`)
