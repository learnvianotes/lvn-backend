#!/usr/bin/env node
/**
 * Phase 9's settings check on a deployed environment (P9b, P9d), as TAP like smoke.mjs: what the review settled, read
 * back from what runs.
 *
 * - The web's security headers (ADR-0090): the Content Security Policy, HSTS, nosniff, the referrer policy.
 * - The API: introspection off outside development; a signed-in person's 601st operation in a minute refused with
 *   429 and Retry-After, counted across both API instances.
 * - Storage: upload links last at most 15 minutes; nothing is listed or read without a signature.
 * - Redis (ADR-0089, --vm only): noeviction, the append-only file, the memory cap.
 *
 *   node scripts/settings-check.mjs <public_url> [--vm infra/local-vm/vm.sh]
 */
import { execFileSync } from 'node:child_process'

const base = process.argv[2]?.replace(/\/$/, '')
const opt = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
if (!base) {
  console.error('usage: node scripts/settings-check.mjs <public_url> [--vm <vm.sh>]')
  process.exit(2)
}

let n = 0
let failed = 0
const ok = (cond, name, detail = '') => {
  n++
  console.log(`${cond ? 'ok' : 'not ok'} ${n} - ${name}${detail ? ` (${detail})` : ''}`)
  if (!cond) failed++
  return cond
}
const post = (body, token) =>
  fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-lvn-client': 'mobile', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
const gql = async (query, variables = {}, token) => {
  const body = await (await post({ query, variables }, token)).json()
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}

// The web's headers.
const home = await fetch(`${base}/`)
const csp = home.headers.get('content-security-policy') ?? ''
const directive = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''
ok(directive('frame-ancestors') === "frame-ancestors 'none'" && directive('object-src') === "object-src 'none'" && directive('base-uri') === "base-uri 'self'", 'the web sends a Content Security Policy that refuses framing, plugins and a changed base', csp.slice(0, 80))
ok(!directive('script-src').includes("'unsafe-eval'"), 'built pages never allow eval')
ok(/max-age=\d{7,}/.test(home.headers.get('strict-transport-security') ?? ''), 'the web asks for HTTPS for a year (HSTS)')
ok(home.headers.get('x-content-type-options') === 'nosniff' && !!home.headers.get('referrer-policy') && !home.headers.get('x-powered-by'), 'nosniff, a referrer policy and no X-Powered-By')

// The API.
const introspection = await (await post({ query: '{ __schema { types { name } } }' })).json()
ok(!!introspection.errors?.length && !introspection.data?.__schema, 'the API refuses introspection')

const { termsVersion } = await gql('{ termsVersion }')
const stamp = Date.now()
const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { message } } }', {
  input: { email: `settings-${stamp}@example.com`, password: `settings passphrase ${stamp}`, displayName: 'Settings Check', dateOfBirth: '2000-01-01', acceptedTermsVersion: termsVersion },
})
const token = up.signUp.session.accessToken
let accepted = 0
for (let sent = 0; sent < 600; sent += 50) {
  const answers = await Promise.all(Array.from({ length: 50 }, () => post({ query: '{ viewer { id } }' }, token)))
  accepted += answers.filter((a) => a.status === 200).length
}
const refused = await post({ query: '{ viewer { id } }' }, token)
const refusal = await refused.json().catch(() => ({}))
ok(accepted === 600 && refused.status === 429 && Number(refused.headers.get('retry-after')) > 0 && refusal.errors?.[0]?.extensions?.code === 'RATE_LIMITED', 'a person’s 601st operation in a minute is refused with 429 and Retry-After', `${accepted} accepted, then ${refused.status}`)

// Storage.
const intent = (await gql('mutation ($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { fileId uploadUrl } userErrors { message } } }', { input: { fileName: 'me.png', mimeType: 'image/png', sizeBytes: 68, purpose: 'AVATAR' } }, token)).createUploadIntent.intent
const url = new URL(intent.uploadUrl)
const expires = Number(url.searchParams.get('X-Amz-Expires'))
ok(expires > 0 && expires <= 900, 'an upload link lasts at most 15 minutes', `${expires} s`)
const bucket = url.pathname.split('/')[1]
const listing = await fetch(`${url.origin}/${bucket}/`)
const unsigned = await fetch(`${url.origin}${url.pathname}`)
ok(listing.status === 403 && unsigned.status === 403, 'storage lists and reads nothing without a signature', `list ${listing.status}, read ${unsigned.status}`)

// Redis.
if (opt('--vm')) {
  const vm = (cmd) => execFileSync(opt('--vm'), ['ssh', cmd], { stdio: 'pipe' }).toString().trim()
  const command = JSON.parse(vm("docker inspect -f '{{json .Config.Cmd}}' lvn-local-redis"))
  const password = command[command.indexOf('--requirepass') + 1]
  const get = (key) => vm(`docker exec lvn-local-redis redis-cli --no-auth-warning -a '${password}' CONFIG GET ${key}`).split('\n')[1]
  const settings = { policy: get('maxmemory-policy'), aof: get('appendonly'), fsync: get('appendfsync'), cap: Number(get('maxmemory')) }
  ok(settings.policy === 'noeviction' && settings.aof === 'yes' && settings.fsync === 'everysec' && settings.cap === 512 * 1024 ** 2, 'Redis keeps every key and writes them to disk every second, within 512 MB', JSON.stringify(settings))
}

console.log(`1..${n}`)
console.log(failed ? `# ${failed} of ${n} checks failed` : `# all ${n} checks passed`)
process.exit(failed ? 1 : 0)
