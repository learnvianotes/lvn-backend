#!/usr/bin/env node
/**
 * Owner recovery when an admin cannot receive the sign-in code.
 *
 * Clears unused codes and the send/verify counters, and opens a window where that account can sign in
 * without a code. Writes an append-only audit row. Another platform admin can do the same in the product
 * with `adminRecoverMfa` (they must already have passed MFA, and they cannot recover themselves).
 *
 *   DATABASE_URL=postgres://... REDIS_URL=redis://... node scripts/mfa-recover.mjs --email admin@example.com --reason "mailbox outage" --hours 24
 *
 * REDIS_URL is optional. Without it the database window still applies. If sign-in still says too many codes,
 * delete `rl:mfa-send:<user id>` and `rl:mfa-verify:<user id>`.
 */
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

const require = createRequire(new URL('../libs/prisma-base/package.json', import.meta.url))
const { Client } = require('pg')

const args = process.argv.slice(2)
const read = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const email = read('--email')
const reason = read('--reason', 'owner recovery')
const hours = Number(read('--hours', '24'))
if (!email || !process.env.DATABASE_URL || !Number.isFinite(hours) || hours < 1 || hours > 168 || !reason) {
  console.error('Usage: DATABASE_URL=... node scripts/mfa-recover.mjs --email admin@example.com [--reason "..."] [--hours 24]')
  process.exit(1)
}

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
let userId
try {
  const found = await client.query('SELECT id FROM users."User" WHERE lower(email::text) = lower($1) AND "deletedAt" IS NULL', [email])
  const user = found.rows[0]
  if (!user) {
    console.error(`No account for ${email}`)
    process.exit(1)
  }
  userId = user.id
  const until = new Date(Date.now() + hours * 60 * 60 * 1000)
  await client.query('BEGIN')
  await client.query('UPDATE users."User" SET "mfaExemptUntil" = $2 WHERE id = $1', [userId, until])
  await client.query('UPDATE users."mfa_challenges" SET "usedAt" = NOW() WHERE "userId" = $1 AND "usedAt" IS NULL', [userId])
  await client.query(
    `INSERT INTO users."AuditLog" (id, "actorId", action, "targetType", "targetId", metadata, "createdAt")
     VALUES ($1, NULL, 'mfa.recovered', 'User', $2, $3::jsonb, NOW())`,
    [randomUUID(), userId, JSON.stringify({ reason, exemptUntil: until.toISOString(), via: 'cli' })],
  )
  await client.query('COMMIT')
  console.log(`Recovery open for ${email} until ${until.toISOString()}.`)
  console.log('They can sign in without a code until then. After that, the emailed code is required again.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  await client.end()
}

if (process.env.REDIS_URL && userId) {
  const Redis = createRequire(new URL('../libs/redis/package.json', import.meta.url))('ioredis')
  const redis = new Redis(process.env.REDIS_URL)
  const deleted = await redis.del(`rl:mfa-send:${userId}`, `rl:mfa-verify:${userId}`)
  console.log(`Cleared ${deleted} Redis counter(s).`)
  await redis.quit()
} else if (userId) {
  console.log(`Redis was not cleared. If they still see "too many codes", delete rl:mfa-send:${userId} and rl:mfa-verify:${userId}.`)
}
