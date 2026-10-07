import { readFileSync } from 'node:fs'
import path from 'node:path'

/** This context's subgraph SDL (ADR-0033); shipped next to the compiled code. */
export const usersTypeDefs = readFileSync(path.join(__dirname, 'users.graphql'), 'utf8')
