#!/usr/bin/env node
/**
 * §6.2 / ADR-0033: composes every context's subgraph SDL with Apollo's composition rules and writes
 *   contracts/graphql/supergraph.graphql   the supergraph (what Apollo Router would load after extraction)
 *   contracts/graphql/schema.graphql       the client-facing API schema (codegen input for web and mobile)
 * Fails on any composition error. `--check` fails if either file changed (CI).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(path.join(root, 'libs/graphql/package.json'))
const { composeServices } = require('@apollo/composition')
const { parse, printSchema, lexicographicSortSchema } = require('graphql')
const check = process.argv.includes('--check')

const contexts = readdirSync(path.join(root, 'contexts')).sort()
const subgraphs = []
for (const ctx of contexts) {
  const dir = path.join(root, 'contexts', ctx, 'src/graphql')
  if (!existsSync(dir)) continue
  const files = readdirSync(dir).filter((f) => f.endsWith('.graphql')).sort()
  if (!files.length) continue
  subgraphs.push({ name: ctx, url: `local://${ctx}`, typeDefs: parse(files.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n')) })
}

const result = composeServices(subgraphs)
if (result.errors?.length) {
  console.error(`Composition failed:\n${result.errors.map((e) => `  ${e.message}`).join('\n')}`)
  process.exit(1)
}

const header = (what) => `# ${what} — composed from contexts/*/src/graphql/*.graphql by scripts/export-supergraph.mjs. Do not edit.\n`
const files = {
  'contracts/graphql/supergraph.graphql': header('LearnViaNotes supergraph') + result.supergraphSdl.trim() + '\n',
  'contracts/graphql/schema.graphql': header('LearnViaNotes API schema') + printSchema(lexicographicSortSchema(result.schema.toAPISchema().toGraphQLJSSchema())) + '\n',
}
let changed = false
for (const [rel, text] of Object.entries(files)) {
  const file = path.join(root, rel)
  if ((existsSync(file) ? readFileSync(file, 'utf8') : '') !== text) {
    writeFileSync(file, text)
    changed = true
    console.log(`wrote ${rel}`)
  }
}
if (check && changed) {
  console.error('The composed schema changed; commit contracts/graphql/*.graphql (and an api-changes/ note if it breaks clients).')
  process.exit(1)
}
