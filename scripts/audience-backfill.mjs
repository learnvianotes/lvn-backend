#!/usr/bin/env node
/**
 * Upsert every active, registration-complete, non-deleted account into the Resend audience, except the study
 * publisher. --dry-run prints counts and exits before any Resend request. This never sends email.
 *
 *   DATABASE_URL=... RESEND_API_KEY=... RESEND_AUDIENCE_ID=... node scripts/audience-backfill.mjs
 *   DATABASE_URL=... node scripts/audience-backfill.mjs --dry-run
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(fileURLToPath(new URL('../libs/prisma-base/package.json', import.meta.url)))
const { Client } = require('pg')

const STUDY_PUBLISHER_ID = '019a118c-f480-7000-8000-000000000001'
const STUDY_PUBLISHER_EMAIL = 'publisher@learnvianotes.invalid'
const dryRun = process.argv.includes('--dry-run')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const WHERE = `
  u."accountStatus" = 'ACTIVE'
  AND u."registrationCompletedAt" IS NOT NULL
  AND u."deletedAt" IS NULL
  AND u.id <> $1
  AND lower(u.email::text) <> $2
`

function splitName(displayName) {
  const parts = String(displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const counts = await db.query(
      `SELECT count(*)::int AS eligible,
              count(*) FILTER (WHERE u."audienceSyncedAt" IS NOT NULL)::int AS "alreadySynced"
       FROM users."User" u
       WHERE ${WHERE}`,
      [STUDY_PUBLISHER_ID, STUDY_PUBLISHER_EMAIL],
    )
    const { eligible, alreadySynced } = counts.rows[0]
    console.log(`eligible: ${eligible}`)
    console.log(`alreadySynced: ${alreadySynced}`)
    // Counts only. No contact is created or changed, and no email is sent.
    if (dryRun) return

    const apiKey = process.env.RESEND_API_KEY
    const audienceId = process.env.RESEND_AUDIENCE_ID
    if (!apiKey || !audienceId) {
      console.error('RESEND_API_KEY and RESEND_AUDIENCE_ID are required unless --dry-run')
      process.exitCode = 1
      return
    }

    const people = await db.query(
      `SELECT u.id, u.email::text AS email, u."displayName",
              COALESCE(s."productEmails", true) AS "productEmails"
       FROM users."User" u
       LEFT JOIN comms."NotificationSettings" s ON s."userId" = u.id
       WHERE ${WHERE}
       ORDER BY u."createdAt"`,
      [STUDY_PUBLISHER_ID, STUDY_PUBLISHER_EMAIL],
    )
    let upserted = 0
    let failed = 0
    for (const person of people.rows) {
      const names = splitName(person.displayName)
      try {
        await upsertContact(apiKey, audienceId, { email: person.email, ...names, unsubscribed: person.productEmails === false })
        await db.query('UPDATE users."User" SET "audienceSyncedAt" = now() WHERE id = $1', [person.id])
        upserted += 1
      } catch (e) {
        failed += 1
        console.error(`failed ${person.id}: ${e instanceof Error ? e.message : 'error'}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
    console.log(`upserted: ${upserted}`)
    console.log(`failed: ${failed}`)
    if (failed) process.exitCode = 1
  } finally {
    await db.end()
  }
}

async function upsertContact(apiKey, audienceId, contact) {
  const created = await request(apiKey, 'POST', `/audiences/${audienceId}/contacts`, {
    email: contact.email,
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
  })
  if (created.ok) return
  if (created.status !== 409 && !/already exists/i.test(created.message)) throw new Error(`create ${created.status}`)
  const encoded = encodeURIComponent(contact.email)
  const updated = await request(apiKey, 'PATCH', `/audiences/${audienceId}/contacts/${encoded}`, {
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
  })
  if (!updated.ok) throw new Error(`update ${updated.status}`)
}

async function request(apiKey, method, path, body) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, message: text.slice(0, 200) }
}

await main()
