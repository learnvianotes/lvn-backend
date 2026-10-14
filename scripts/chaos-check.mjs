#!/usr/bin/env node
/**
 * Chaos on the local environment (Phase 9, P9e), as TAP like smoke.mjs. While a writer saves a note every 200 ms the
 * way the phone does (its own id, the same id again after a failure, "already exists" meaning saved), each service is
 * restarted in turn: both API instances, the worker, Redis, Postgres and the web. Each must come back, and the writer
 * with it. Then a queued job must outlive a Redis restart with the worker stopped (BullMQ's jobs are in Redis, kept by
 * its append-only file, ADR-0089). At the end every note the API acknowledged must be there.
 *
 *   node scripts/chaos-check.mjs <public_url> --vm infra/local-vm/vm.sh
 */
import { execFileSync } from 'node:child_process'

const base = process.argv[2]?.replace(/\/$/, '')
const opt = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
const vm = opt('--vm')
if (!base || !vm) {
  console.error('usage: node scripts/chaos-check.mjs <public_url> --vm <vm.sh>')
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const docker = (...args) => execFileSync(vm, ['ssh', `docker ${args.join(' ')}`], { stdio: 'pipe' }).toString().trim()

/** One GraphQL request: { data } or { error }, never a throw (the API may be down). */
async function gql(query, variables = {}, token) {
  try {
    const res = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lvn-client': 'mobile', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await res.json().catch(() => ({ errors: [{ message: `HTTP ${res.status}` }] }))
    if (body.errors?.length) return { error: body.errors.map((e) => e.message).join('; ') }
    return { data: body.data }
  } catch (e) {
    return { error: String(e.message ?? e) }
  }
}
const must = async (query, variables, token) => {
  const r = await gql(query, variables, token)
  if (r.error) throw new Error(r.error)
  return r.data
}
const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(16))
  let ms = Date.now()
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256
    ms = Math.floor(ms / 256)
  }
  b[6] = 0x70 | (b[6] & 0x0f)
  b[8] = 0x80 | (b[8] & 0x3f)
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
const ready = async () => {
  try {
    return (await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(3_000) })).status === 200
  } catch {
    return false
  }
}
async function eventually(check, ms) {
  const until = Date.now() + ms
  for (;;) {
    if (await check().catch(() => false)) return true
    if (Date.now() > until) return false
    await sleep(500)
  }
}

const stamp = Date.now()
const { termsVersion } = await must('{ termsVersion }')
const signUp = async (who) => {
  const up = await must('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', {
    input: { email: `chaos-${who}-${stamp}@example.com`, password: `chaos passphrase ${stamp}`, displayName: `Chaos ${who}`, dateOfBirth: '2000-01-01', acceptedTermsVersion: termsVersion },
  })
  return up.signUp.session.accessToken
}

// The writer: a note every 200 ms, each retried under its own id until the API says it is saved or already there.
const writer = { token: await signUp('writer'), acked: [], attempts: 0, failures: 0, lastAck: Date.now(), stop: false }
const CREATE = 'mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }'
const writing = (async () => {
  while (!writer.stop) {
    const id = newId()
    for (;;) {
      writer.attempts++
      const r = await gql(CREATE, { input: { id, title: `Chaos ${writer.acked.length + 1}` } }, writer.token)
      const errors = r.data?.createNote.userErrors ?? []
      const saved = r.data && (r.data.createNote.note || errors.some((e) => /already exists/.test(e.message)))
      if (saved) {
        writer.acked.push(id)
        writer.lastAck = Date.now()
        break
      }
      writer.failures++
      if (writer.stop) break
      await sleep(500)
    }
    await sleep(200)
  }
})()

await sleep(3_000)
ok(writer.acked.length > 5, 'the writer saves notes before any restart', `${writer.acked.length} saved`)

for (const service of ['api', 'api-2', 'worker', 'redis', 'postgres', 'web']) {
  const name = `lvn-local-${service}`
  const before = writer.acked.length
  const started = Date.now()
  docker('restart', '-t', '10', name)
  const back = await eventually(async () => (await ready()) && docker('inspect', '-f', "'{{.State.Health.Status}}'", name).replace('<no value>', 'healthy') !== 'starting', 120_000)
  const recovered = await eventually(async () => writer.acked.length > before + 2, 60_000)
  ok(back && recovered, `${service} restarts and saving carries on`, `${Math.round((Date.now() - started) / 1000)} s, ${writer.acked.length - before} saved since`)
  if (service === 'web') ok((await fetch(`${base}/`)).status === 200, 'the web answers after its restart')
  await sleep(5_000)
}

// A job queued while the worker is stopped outlives a Redis restart, then runs.
const exporter = await signUp('exporter')
docker('stop', '-t', '10', 'lvn-local-worker')
const asked = await gql('mutation { requestDataExport { export { id status } userErrors { message } } }', {}, exporter)
ok(asked.data?.requestDataExport.export?.status === 'PENDING', 'an export is queued while the worker is stopped', asked.error ?? '')
docker('restart', '-t', '10', 'lvn-local-redis')
await eventually(ready, 60_000)
docker('start', 'lvn-local-worker')
const done = await eventually(async () => (await must('{ myDataExports { status } }', {}, exporter)).myDataExports[0]?.status === 'READY', 180_000)
ok(done, 'the queued export runs once the worker is back, after Redis restarted')

writer.stop = true
await writing
let missing = 0
for (const id of writer.acked) {
  const r = await gql('query ($id: UUID!) { note(id: $id) { id } }', { id }, writer.token)
  if (!r.data?.note) missing++
}
ok(missing === 0, 'every note the API acknowledged is there', `${writer.acked.length} acknowledged, ${missing} missing, ${writer.failures} failed attempts retried`)

console.log(`1..${n}`)
console.log(failed ? `# ${failed} of ${n} checks failed` : `# all ${n} checks passed`)
process.exit(failed ? 1 : 0)
