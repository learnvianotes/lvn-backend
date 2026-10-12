import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** This context's subgraph SDL (ADR-0033): every *.graphql next to this file, in name order. */
export const communicationTypeDefs = readdirSync(__dirname)
  .filter((f) => f.endsWith('.graphql'))
  .sort()
  .map((f) => readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n')
