#!/usr/bin/env node
/**
 * The note lifecycle on a deployed environment (spec §18, Phase 2 exit), through its single entrance, as TAP like
 * smoke.mjs: two people, A and B. A writes a note, publishes it, shares it with B, makes it public; anonymous visitors
 * read its page, the sitemap lists it and search finds it; B copies it; A publishes a second version and the page
 * follows; A makes it private again and it leaves the page, the sitemap and search; a device of A's syncs it and sends
 * an edit made offline; A moves it to the trash and back. Publishing needs a verified account: on the local
 * environment A is verified through its database (--vm), elsewhere pass a verified account's token (--token-a).
 *
 *   node scripts/lifecycle-check.mjs <public_url> --vm infra/local-vm/vm.sh
 *   node scripts/lifecycle-check.mjs <public_url> --token-a <access token of a verified account>
 */
import { execFileSync } from 'node:child_process'

const base = process.argv[2]?.replace(/\/$/, '')
const opt = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
if (!base || (!opt('--vm') && !opt('--token-a'))) {
  console.error('usage: node scripts/lifecycle-check.mjs <public_url> (--vm <vm.sh> | --token-a <token>)')
  process.exit(2)
}

let n = 0
let failed = 0
const ok = (cond, name, detail = '') => {
  n++
  if (cond) console.log(`ok ${n} - ${name}${detail ? ` (${detail})` : ''}`)
  else {
    failed++
    console.log(`not ok ${n} - ${name}${detail ? ` (${detail})` : ''}`)
  }
  return cond
}
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
const text = (s) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
/** Waits for a condition the queues and caches reach in a moment (search indexing, page revalidation). */
async function eventually(check, ms = 45_000) {
  const until = Date.now() + ms
  for (;;) {
    if (await check().catch(() => false)) return true
    if (Date.now() > until) return false
    await new Promise((r) => setTimeout(r, 1000))
  }
}
const page = async (path) => {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' })
  return { status: res.status, body: res.status === 200 ? await res.text() : '' }
}
const stamp = Date.now()
const WORD = `lifecycle${stamp}`

const { termsVersion } = await gql('{ termsVersion }')
const signUp = async (who) => {
  const email = `lifecycle-${who}-${stamp}@example.com`
  const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', {
    input: { email, password: `lifecycle passphrase ${stamp}`, displayName: `Lifecycle ${who.toUpperCase()}`, dateOfBirth: '2000-01-01', acceptedTermsVersion: termsVersion },
  })
  return { email, token: up.signUp.session.accessToken, id: up.signUp.session.user.id, handle: null }
}
let A
if (opt('--token-a')) {
  A = { token: opt('--token-a') }
  A.id = (await gql('{ viewer { id } }', {}, A.token)).viewer.id
} else {
  A = await signUp('a')
  execFileSync(opt('--vm'), ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -c "UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'TEACHER' WHERE id = '${A.id}'"`], { stdio: 'pipe' })
}
const B = await signUp('b')
B.handle = (await gql('{ viewer { handle } }', {}, B.token)).viewer.handle

// Writing and publishing.
const created = await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }', { input: { title: `Heaps ${WORD}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(`A heap keeps the smallest item on top. ${WORD}`) }] } }, A.token)
const id = created.createNote.note.id
ok(!!id, 'A writes a note')
const second = newId()
const saved = await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } userErrors { message } } }', { input: { noteId: id, ops: [{ kind: 'UPSERT', id: second, type: 'heading', position: 'a1', content: { level: 2, content: [{ type: 'text', text: 'Push and pop' }] } }] } }, A.token)
ok(saved.updateNoteDraft.results[0]?.status === 'APPLIED', 'autosave applies a card')
const v1 = await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { publishedVersion { number } } userErrors { message } } }', { input: { noteId: id } }, A.token)
ok(v1.publishNote.note?.publishedVersion?.number === 1, 'A publishes version 1', v1.publishNote.userErrors[0]?.message)

// Sharing.
const shared = await gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { visibility } userErrors { message } } }', { input: { noteId: id, person: B.handle, role: 'VIEWER' } }, A.token)
ok(shared.shareNote.note?.visibility === 'SHARED', 'A shares it with B to read', shared.shareNote.userErrors[0]?.message)
const seenByB = await gql('query ($id: UUID!) { note(id: $id) { viewerAccess viewerCan { edit } } }', { id }, B.token)
ok(seenByB.note?.viewerAccess === 'READER' && seenByB.note.viewerCan.edit === false, 'B reads it and cannot edit it')

// Public.
const vis = await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { visibility slug moderation { state } } userErrors { message } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, A.token)
const slug = vis.changeNoteVisibility.note?.slug
ok(vis.changeNoteVisibility.note?.visibility === 'PUBLIC', 'A makes it public', vis.changeNoteVisibility.userErrors[0]?.message ?? vis.changeNoteVisibility.note?.moderation?.state)
const path = `/n/${slug}-${id}`
ok(await eventually(async () => (await page(path)).body.includes(WORD)), 'anonymous visitors read its page', path)
ok(await eventually(async () => (await page('/sitemap.xml')).body.includes(id)), 'the sitemap lists it')
const found = async (token) => (await gql('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: WORD }, token)).search.notes.some((h) => h.note.id === id)
ok(await eventually(() => found()), 'anonymous search finds it')

// A copy.
const fork = await gql('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id visibility forkedFrom { author { id } } } userErrors { message } } }', { input: { noteId: id } }, B.token)
ok(fork.forkNote.note?.visibility === 'PRIVATE' && fork.forkNote.note.forkedFrom?.author.id === A.id, 'B copies it, privately, with the credit to A')

// A second version, and the page follows.
await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId: id, title: `Binary heaps ${WORD}` } }, A.token)
const v2 = await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { publishedVersion { number } slug } } }', { input: { noteId: id } }, A.token)
ok(v2.publishNote.note.publishedVersion.number === 2, 'A publishes version 2')
const path2 = `/n/${v2.publishNote.note.slug}-${id}`
ok(await eventually(async () => (await page(path2)).body.includes('Binary heaps')), 'the public page shows version 2', path2)
ok(await eventually(async () => [301, 308].includes((await page(path)).status)), 'the old address moves to the new one')

// Private again.
await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { visibility } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, A.token)
ok(await eventually(async () => (await page(path2)).status === 404), 'made private, its page is gone')
ok(!(await found()), 'and search no longer finds it')
ok(await eventually(async () => !(await page('/sitemap.xml')).body.includes(id)), 'and the sitemap no longer lists it')
const copy = await gql('query ($id: UUID!) { note(id: $id) { id } }', { id: fork.forkNote.note.id }, B.token)
ok(copy.note?.id === fork.forkNote.note.id, 'B keeps the copy')

// A device: sync, an edit made offline, sent later.
const pulled = await gql('query { syncPull(first: 50) { notes { note { id } cards { id } } cursor } }', {}, A.token)
ok(pulled.syncPull.notes.some((x) => x.note.id === id), "A's phone pulls the note")
const pushed = await gql('mutation ($ops: [SyncOpInput!]!) { syncPush(ops: $ops) { results { clientOpId status message } } }', { ops: [{ clientOpId: newId(), kind: 'UPDATE_NOTE', noteId: id, ops: [{ kind: 'UPSERT', id: newId(), type: 'text', position: 'a2', content: text('Written on the train') }] }] }, A.token)
ok(pushed.syncPush.results[0]?.status === 'APPLIED', 'an edit made offline on the phone is applied', pushed.syncPush.results[0]?.message)

// Trash and back.
await gql('mutation ($input: NoteIdInput!) { deleteNote(input: $input) { note { id } } }', { input: { noteId: id } }, A.token)
const trashed = await gql('query { myNotes(filter: { trashed: true }) { edges { node { id } } } }', {}, A.token)
ok(trashed.myNotes.edges.some((e) => e.node.id === id), 'A moves it to the trash')
await gql('mutation ($input: NoteIdInput!) { restoreNote(input: $input) { note { id } } }', { input: { noteId: id } }, A.token)
const restored = await gql('query ($id: UUID!) { note(id: $id) { deletedAt cards { edges { node { id } } } } }', { id }, A.token)
ok(restored.note.deletedAt === null && restored.note.cards.edges.length === 3, 'and restores it with its three cards')

console.log(`1..${n}`)
if (failed) {
  console.log(`# ${failed} of ${n} checks failed`)
  process.exit(1)
}
console.log(`# all ${n} checks passed`)
