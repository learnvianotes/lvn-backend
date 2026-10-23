#!/usr/bin/env node
/**
 * What the migrate container runs (infra/lightsail/compose.yaml). Prisma migrations first, then the
 * Markdown catalogue in content/study. Needs DATABASE_URL and nothing else. Does not delete rows,
 * and does not add or rewrite migration files.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('error', reject)
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`prisma migrate deploy exited ${code}`))))
})

const { syncStudyContent } = require('./contexts/notes/dist/application/study-content-sync.js')
const report = await syncStudyContent(process.env.DATABASE_URL, path.join(root, 'content', 'study'))
console.log(JSON.stringify(report))
