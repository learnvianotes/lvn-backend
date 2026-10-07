#!/usr/bin/env node
/**
 * TypeScript types for each context's subgraph SDL (ADR-0033): contexts/<ctx>/src/graphql/*.graphql →
 * contexts/<ctx>/src/graphql/schema.types.ts. The SDL is built with Apollo's buildSubgraphSchema, so federation
 * directives are understood; federation's own types (_Service, _Entity, …) are left out.
 *
 *   node scripts/graphql-types.mjs <context>            write the file
 *   node scripts/graphql-types.mjs <context> --check    fail if the committed file is stale (CI)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const ctx = process.argv[2]
const check = process.argv.includes('--check')
if (!ctx) throw new Error('usage: graphql-types.mjs <context> [--check]')

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'contexts', ctx, 'src/graphql')
const require = createRequire(path.join(root, 'libs/graphql/package.json'))
const { buildSubgraphSchema } = require('@apollo/subgraph')
const graphql = require('graphql')
const { parse, isEnumType, isInputObjectType, isInterfaceType, isListType, isNonNullType, isObjectType, isScalarType, isUnionType } = graphql

const SCALARS = { ID: 'string', String: 'string', Boolean: 'boolean', Int: 'number', Float: 'number', DateTime: 'Date', UUID: 'string', JSON: 'unknown' }
const FEDERATION = /^(_|link__|federation__|join__)/

const sdl = readdirSync(dir).filter((f) => f.endsWith('.graphql')).sort().map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n')
const schema = buildSubgraphSchema([{ typeDefs: parse(sdl) }])

/** TypeScript for a GraphQL type reference; nullable outputs become `T | null`, nullable inputs optional. */
function ts(type) {
  if (isNonNullType(type)) return inner(type.ofType)
  return `${inner(type)} | null`
}
function inner(type) {
  if (isNonNullType(type)) return inner(type.ofType)
  if (isListType(type)) return `Array<${ts(type.ofType)}>`
  if (isScalarType(type)) return SCALARS[type.name] ?? 'unknown'
  return type.name
}
const doc = (d, indent = '') => (d ? `${indent}/** ${d.replace(/\*\//g, '*\\/').split('\n').join(`\n${indent} * `)} */\n` : '')

const out = ["// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.", '/* eslint-disable */', '']
const types = Object.values(schema.getTypeMap())
  .filter((t) => !t.name.startsWith('__') && !FEDERATION.test(t.name) && !SCALARS[t.name])
  .sort((a, b) => a.name.localeCompare(b.name))

for (const t of types) {
  if (isEnumType(t)) {
    out.push(`${doc(t.description)}export type ${t.name} = ${t.getValues().map((v) => `'${v.name}'`).join(' | ')}`, '')
  } else if (isInputObjectType(t)) {
    const fields = Object.values(t.getFields()).map((f) => `${doc(f.description, '  ')}  ${f.name}${isNonNullType(f.type) ? '' : '?'}: ${ts(f.type)}`)
    out.push(`${doc(t.description)}export interface ${t.name} {`, ...fields, '}', '')
  } else if (isObjectType(t) || isInterfaceType(t)) {
    const fields = Object.values(t.getFields()).filter((f) => !FEDERATION.test(f.name))
    if (!fields.length) continue
    const root = t.name === 'Query' || t.name === 'Mutation' || t.name === 'Subscription'
    if (!root) {
      out.push(`${doc(t.description)}export interface ${t.name} {`, ...fields.map((f) => `${doc(f.description, '  ')}  ${f.name}: ${ts(f.type)}`), '}', '')
    }
    for (const f of fields.filter((f) => f.args.length)) {
      const name = `${t.name}${f.name[0].toUpperCase()}${f.name.slice(1)}Args`
      out.push(`export interface ${name} {`, ...f.args.map((a) => `  ${a.name}${isNonNullType(a.type) ? '' : '?'}: ${ts(a.type)}`), '}', '')
    }
  } else if (isUnionType(t)) {
    out.push(`export type ${t.name} = ${t.getTypes().map((m) => m.name).join(' | ')}`, '')
  }
}

const file = path.join(dir, 'schema.types.ts')
const text = out.join('\n').replace(/\n+$/, '\n')
const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
if (text !== before) {
  writeFileSync(file, text)
  if (check) {
    console.error(`${path.relative(root, file)} was stale; regenerated. Commit it.`)
    process.exit(1)
  }
}
