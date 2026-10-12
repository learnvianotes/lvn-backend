#!/usr/bin/env node
/**
 * Search speed on a deployed environment (spec §18, Phase 4 exit: p95 under 150 ms; ADR-0057). Seeds a corpus straight
 * into the local environment's database (a bench owner with N notes in words from a fixed vocabulary — public, shared
 * with the bench reader, private — some with a topic), waits until search has indexed them (the outbox is empty), then
 * times Q `search` requests through the entrance from C clients at once: anonymous and signed in, one and two words,
 * prefixes, a typo, filters and a second page. Prints p50, p95 and p99, fails above a p95 of 150 ms, and removes the
 * corpus (the drainer removes its documents).
 *
 *   node scripts/search-bench.mjs <public_url> --vm infra/local-vm/vm.sh [--notes 10000] [--queries 500] [--clients 4] [--keep]
 */
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const base = process.argv[2]?.replace(/\/$/, '')
const opt = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback)
const vm = opt('--vm')
if (!base || !vm) {
  console.error('usage: node scripts/search-bench.mjs <public_url> --vm <vm.sh> [--notes N] [--queries Q] [--clients C] [--keep]')
  process.exit(2)
}
const NOTES = Number(opt('--notes', 10_000))
const QUERIES = Number(opt('--queries', 500))
const CLIENTS = Number(opt('--clients', 4))
const BUDGET_MS = 150

/** SQL through the VM; statements come on stdin, so a large corpus needs no command line of its own. */
const psql = (input, flags = []) => execFileSync(vm, ['ssh', `docker exec -i lvn-local-postgres psql -U lvn -d lvn -v ON_ERROR_STOP=1 ${flags.join(' ')}`], { input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString()
async function gql(query, variables = {}, token) {
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-lvn-client': 'mobile', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}

// A small deterministic generator, so two runs search the same corpus.
let seed = 20261013
const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31)
const pick = (list) => list[Math.floor(random() * list.length)]
const VOCABULARY = (
  'algorithm array binary bit bloom branch breadth buffer cache cardinality chain closure compiler complexity concurrency ' +
  'consensus constraint convex cycle database deadlock depth derivative dijkstra distributed dynamic edge eigenvalue ' +
  'entropy euler fibonacci flow fourier fractal function garbage gradient graph greedy hash heap heuristic huffman ' +
  'integral interrupt invariant iterator kernel lambda lattice linear linked lock logarithm markov matrix memo merge ' +
  'mutex network newton node normal object optimal overflow packet parser partition permutation pipeline pointer ' +
  'polynomial prefix prime priority probability process protocol queue quick radix recursion regression register ' +
  'relation replication router sampling scheduler schema semaphore sequence set shortest signal sort spanning stack ' +
  'statistics stream string subset suffix symmetric thread token topology transaction transform traversal tree trie ' +
  'tuple union vector vertex virtual voronoi wavelet'
).split(' ')
const sentence = (n) => Array.from({ length: n }, () => pick(VOCABULARY)).join(' ')

const stamp = Date.now()
const { termsVersion } = await gql('{ termsVersion }')
const signUp = async (who) => {
  const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', {
    input: { email: `bench-${who}-${stamp}@example.com`, password: `bench passphrase ${stamp}`, displayName: `Bench ${who}`, dateOfBirth: '2000-01-01', acceptedTermsVersion: termsVersion },
  })
  return { token: up.signUp.session.accessToken, id: up.signUp.session.user.id }
}
const owner = await signUp('owner')
const reader = await signUp('reader')

// The corpus: notes, then their published versions, then the publish itself (whose trigger marks each for search).
console.log(`# seeding ${NOTES} notes`)
const topics = psql('SELECT id FROM notes."Topic" WHERE origin = \'CURATED\' LIMIT 50', ['-At']).split('\n').filter(Boolean)
const ids = []
for (let start = 0; start < NOTES; start += 500) {
  const rows = []
  for (let i = start; i < Math.min(start + 500, NOTES); i++) {
    const id = randomUUID()
    const version = randomUUID()
    const r = random()
    const visibility = r < 0.7 ? 'PUBLIC' : r < 0.9 ? 'SHARED' : 'PRIVATE'
    const title = sentence(3)
    const cards = Array.from({ length: 3 }, (_, c) => ({ id: randomUUID(), type: 'text', position: `a${c}`, revision: 1, content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: sentence(60) }] }] } } }))
    ids.push(id)
    rows.push({ id, version, visibility, title, cards: JSON.stringify(cards).replace(/'/g, "''"), topic: random() < 0.3 ? pick(topics) : null })
  }
  const sql = [
    'BEGIN;',
    `INSERT INTO notes."Note" (id, "ownerId", title, visibility, "updatedAt") VALUES ${rows.map((n) => `('${n.id}', '${owner.id}', '${n.title}', '${n.visibility}', now())`).join(',')};`,
    `INSERT INTO notes."NoteVersion" (id, "noteId", number, kind, title, cards, "createdById") VALUES ${rows.map((n) => `('${n.version}', '${n.id}', 1, 'PUBLISHED', '${n.title}', '${n.cards}'::jsonb, '${owner.id}')`).join(',')};`,
    ...rows.map((n) => `UPDATE notes."Note" SET "publishedVersionId" = '${n.version}', "publishedAt" = now() WHERE id = '${n.id}';`),
    ...rows.filter((n) => n.visibility === 'SHARED').map((n) => `INSERT INTO notes."NoteShare" ("noteId", "userId", role, "createdById") VALUES ('${n.id}', '${reader.id}', 'VIEWER', '${owner.id}');`),
    ...rows.filter((n) => n.topic).map((n) => `INSERT INTO notes."NoteTopic" ("noteId", "topicId") VALUES ('${n.id}', '${n.topic}');`),
    'COMMIT;',
  ].join('\n')
  psql(sql)
}

const pending = () => Number(psql('SELECT count(*) FROM notes."SearchChange"', ['-At']).trim())
const started = Date.now()
for (let left = pending(); left > 0; left = pending()) {
  if (Date.now() - started > 15 * 60_000) throw new Error(`search did not catch up: ${left} changes left`)
  await new Promise((r) => setTimeout(r, 2000))
}
console.log(`# indexed in ${Math.round((Date.now() - started) / 1000)} s`)

// The requests: what people type, with and without an account, sometimes narrowed or continued.
const SEARCH = 'query ($q: String!, $filters: SearchFilters, $after: String) { search(query: $q, first: 10, filters: $filters, after: $after) { notes { snippet note { id title } } notesCursor people { id } topics { id } groups { id } classrooms { id } } }'
const shapes = [
  () => ({ q: pick(VOCABULARY) }),
  () => ({ q: `${pick(VOCABULARY)} ${pick(VOCABULARY)}` }),
  () => ({ q: pick(VOCABULARY).slice(0, 4) }),
  () => ({ q: pick(VOCABULARY).replace(/(.)(.)/, '$2$1') }),
  () => ({ q: pick(VOCABULARY), filters: { sources: ['SHARED'] } }),
  () => ({ q: pick(VOCABULARY), filters: { kinds: ['NOTE'], sources: ['PUBLIC'] } }),
]
const times = []
let errors = 0
let next = 0
const client = async () => {
  while (next < QUERIES) {
    const i = next++
    const vars = pick(shapes)()
    const token = i % 2 ? reader.token : undefined
    const t0 = performance.now()
    try {
      const first = await gql(SEARCH, vars, token)
      times.push(performance.now() - t0)
      if (i % 10 === 0 && first.search.notesCursor) {
        const t1 = performance.now()
        await gql(SEARCH, { ...vars, after: first.search.notesCursor }, token)
        times.push(performance.now() - t1)
      }
    } catch {
      errors++
    }
  }
}
await gql(SEARCH, { q: 'warm' })
await Promise.all(Array.from({ length: CLIENTS }, client))
times.sort((a, b) => a - b)
const at = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))].toFixed(1)
console.log(`# ${times.length} searches over ${NOTES} notes from ${CLIENTS} clients, ${errors} errors`)
console.log(`# p50 ${at(50)} ms, p95 ${at(95)} ms, p99 ${at(99)} ms`)
const p95 = Number(at(95))

if (!process.argv.includes('--keep')) {
  for (let i = 0; i < ids.length; i += 1000) psql(`DELETE FROM notes."Note" WHERE id IN (${ids.slice(i, i + 1000).map((id) => `'${id}'`).join(',')});`)
  console.log('# the corpus is removed (the drainer removes its documents)')
}
if (errors || p95 >= BUDGET_MS) {
  console.log(`not ok - search p95 ${p95} ms (budget ${BUDGET_MS} ms), ${errors} errors`)
  process.exit(1)
}
console.log(`ok - search p95 ${p95} ms is under ${BUDGET_MS} ms`)
