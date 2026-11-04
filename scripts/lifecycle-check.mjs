#!/usr/bin/env node
/**
 * The note lifecycle on a deployed environment (spec §18, Phase 2 exit), through its single entrance, as TAP like
 * smoke.mjs: two people, A and B. A writes a note, publishes it, shares it with B (every live socket of B's hears of it,
 * on either API instance, ADR-0042), makes it public; anonymous visitors read its page, the sitemap lists it and
 * search finds it (on Typesense, typos and all, ADR-0055); B copies it; A publishes a second version and the page
 * follows; A makes it private again and it leaves the page, the sitemap and search; a device of A's syncs it and sends
 * an edit made offline; A moves it to the trash and back; a picture on it gets its sizes and an infected file is
 * quarantined (ADR-0041, with the environment's ClamAV). On the local environment, groups, classes, workspaces, feeds and
 * their moderation follow (Phase 3). Publishing needs a verified account: on the local environment
 * A is verified through its database (--vm), elsewhere pass a verified account's token (--token-a).
 *
 *   node scripts/lifecycle-check.mjs <public_url> --vm infra/local-vm/vm.sh
 *   node scripts/lifecycle-check.mjs <public_url> --token-a <access token of a verified account>
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

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
// The EICAR test string as a PDF stream, which ClamAV unpacks and flags (apps/api/test/support/fake-clamd.ts).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
const EICAR_PDF = Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Length ${EICAR.length} >>\nstream\n${EICAR}\nendstream\nendobj\ntrailer << >>\n%%EOF\n`, 'latin1')
/** SQL on the local environment's database, through the VM (--vm only). */
const sql = (statement) => execFileSync(opt('--vm'), ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -c "${statement}"`], { stdio: 'pipe' })
const stamp = Date.now()
const WORD = `lifecycle${stamp}`

const { termsVersion } = await gql('{ termsVersion }')
const signUp = async (who) => {
  const email = `lifecycle-${who}-${stamp}@example.com`
  const up = await gql('mutation ($input: SignUpInput!) { signUp(input: $input) { session { accessToken user { id } } userErrors { message } } }', {
    input: { email, password: `lifecycle passphrase ${stamp}`, displayName: `Lifecycle ${who.toUpperCase()}`, age: 26, acceptedTermsVersion: termsVersion },
  })
  return { email, token: up.signUp.session.accessToken, id: up.signUp.session.user.id, handle: null }
}
let A
if (opt('--token-a')) {
  A = { token: opt('--token-a') }
  A.id = (await gql('{ viewer { id } }', {}, A.token)).viewer.id
} else {
  A = await signUp('a')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'TEACHER' WHERE id = '${A.id}'`)
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

// Sharing, announced live to every socket of B's, whichever API instance holds it (ADR-0042): the entrance hands
// consecutive connections to the instances in turn, so four sockets cover both.
const sockets = await Promise.all([0, 1, 2, 3].map(() => openLive(B.token)))
const shared = await gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { visibility } userErrors { message } } }', { input: { noteId: id, person: B.handle, role: 'VIEWER' } }, A.token)
ok(shared.shareNote.note?.visibility === 'SHARED', 'A shares it with B to read', shared.shareNote.userErrors[0]?.message)
const seenByB = await gql('query ($id: UUID!) { note(id: $id) { viewerAccess viewerCan { edit } } }', { id }, B.token)
ok(seenByB.note?.viewerAccess === 'READER' && seenByB.note.viewerCan.edit === false, 'B reads it and cannot edit it')
const heard = await Promise.all(sockets.map((s) => s.next(10_000).catch(() => null)))
ok(heard.every((e) => e?.kind === 'NOTIFICATION'), 'every live socket of B hears of the share, on either API instance', `${heard.filter(Boolean).length}/4`)
sockets.forEach((s) => s.close())
const inbox = await gql('{ unreadNotificationCount notifications(first: 1) { edges { node { id category path actor { id } note { id } } } } }', {}, B.token)
const latest = inbox.notifications.edges[0]?.node
ok(latest?.category === 'SHARE' && latest.note?.id === id && latest.actor?.id === A.id && latest.id === heard[0]?.id, 'B is notified: who shared which note', `${inbox.unreadNotificationCount} unread`)

// Public.
const vis = await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { visibility slug moderation { state } } userErrors { message } } }', { input: { noteId: id, visibility: 'PUBLIC' } }, A.token)
const slug = vis.changeNoteVisibility.note?.slug
ok(vis.changeNoteVisibility.note?.visibility === 'PUBLIC', 'A makes it public', vis.changeNoteVisibility.userErrors[0]?.message ?? vis.changeNoteVisibility.note?.moderation?.state)
// Community (ADR-0076): A gives the note a topic B follows, so it is in B's For You. On the local environment, where
// accounts are verified by SQL, a verified reader's reaction puts it in Trending (reacting needs a verified account).
let trended = false
{
  const topic = (await gql('query ($q: String!) { examTopicOptions(query: $q) { id } }', { q: 'array' }, A.token)).examTopicOptions[0]
  if (topic) {
    await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { userErrors { message } } }', { input: { noteId: id, topicIds: [topic.id] } }, A.token)
    await gql('mutation ($input: UpdateProfileInput!) { updateProfile(input: $input) { userErrors { message } } }', { input: { interestTopicIds: [topic.id] } }, B.token)
    const forYou = (await gql('{ forYouFeed(first: 50) { edges { node { id } } basedOn { id } } }', {}, B.token)).forYouFeed
    ok(forYou.edges.some((e) => e.node?.id === id) && forYou.basedOn.some((t) => t?.id === topic.id), 'B follows its topic: it is in B\'s For You', JSON.stringify(forYou.basedOn))
  }
  if (opt('--vm')) {
    const fan = await signUp('t')
    // A week old too, so the reaction also counts for A's points (ADR-0080).
    sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL', \\"createdAt\\" = now() - interval '10 days' WHERE id = '${fan.id}'`)
    const reacted = (await gql('mutation ($input: ReactInput!) { react(input: $input) { userErrors { message } } }', { input: { kind: 'HELPFUL', target: { type: 'NOTE', id } } }, fan.token)).react
    const trending = (await gql('{ trendingFeed(first: 100) { edges { node { id } } } }', {}, A.token)).trendingFeed.edges.map((e) => e.node?.id)
    trended = trending.includes(id)
    ok(trended, 'a reader reacts to it: it is trending', reacted.userErrors[0]?.message)
    ok(await eventually(async () => (await myPoints(A.token)).some((e) => e.rule === 'REACTION' && e.delta === 1)), 'the reaction earns A a point')
  }
}
/** A person's points history (ADR-0080). */
async function myPoints(token) {
  return (await gql('{ myPoints(first: 50) { edges { node { rule delta } } } }', {}, token)).myPoints.edges.map((e) => e.node)
}
// Saved notes (ADR-0076): B saves it to come back to; only B's list has it, and A cannot tell.
const savedNoteIds = async (token) => (await gql('{ savedNotes { edges { node { id } } } }', {}, token)).savedNotes.edges.map((e) => e.node.id)
const kept = (await gql('mutation ($input: NoteIdInput!) { saveNote(input: $input) { note { viewerSaved } userErrors { message } } }', { input: { noteId: id } }, B.token)).saveNote
const seenByA = (await gql('query ($id: UUID!) { note(id: $id) { viewerSaved } }', { id }, A.token)).note?.viewerSaved
ok(kept.note?.viewerSaved === true && (await savedNoteIds(B.token)).includes(id) && !(await savedNoteIds(A.token)).includes(id) && seenByA === false, 'B saves it; it is in B\'s Saved alone, and A cannot tell', JSON.stringify([kept.userErrors, seenByA]))
const path = `/n/${slug}-${id}`
ok(await eventually(async () => (await page(path)).body.includes(WORD)), 'anonymous visitors read its page', path)
ok(await eventually(async () => (await page('/sitemap.xml')).body.includes(id)), 'the sitemap lists it')
const found = async (token) => (await gql('query ($q: String!) { search(query: $q) { notes { note { id } } } }', { q: WORD }, token)).search.notes.some((h) => h.note.id === id)
ok(await eventually(() => found()), 'anonymous search finds it')
// Only Typesense matches a typo in a note's words (Postgres forgives typos in titles alone): this shows who answers.
const typo = async () => (await gql('query { search(query: "smalest item on top", scopes: [NOTES], first: 20) { notes { note { id } } } }')).search.notes.some((h) => h.note.id === id)
ok(await eventually(typo, 15_000), 'a typo in its words finds it too: Typesense answers (ADR-0055)')

// A copy.
const fork = await gql('mutation ($input: NoteIdInput!) { forkNote(input: $input) { note { id visibility forkedFrom { author { id } } } userErrors { message } } }', { input: { noteId: id } }, B.token)
ok(fork.forkNote.note?.visibility === 'PRIVATE' && fork.forkNote.note.forkedFrom?.author.id === A.id, 'B copies it, privately, with the credit to A')

// AI tasks (ADR-0059), where the environment's AI answers (ADR-0058; locally, the dev machine's Ollama): B, a reader,
// asks for flashcards of the published version, the worker makes them with the real model, B keeps one as a note of
// their own, and A's note and its versions are untouched; only B sees the result, and the tokens count against B's day.
const aiStatus = (await gql('{ aiStatus { available reason } }')).aiStatus
if (aiStatus.available) {
  const run = await gql('mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id status } userErrors { message } } }', { input: { noteId: id, task: 'FLASHCARDS' } }, B.token)
  const artifactId = run.runAiTask.artifact?.id
  ok(run.runAiTask.artifact?.status === 'QUEUED', "B asks AI for flashcards of A's note", run.runAiTask.userErrors[0]?.message)
  let made
  // The local model answers one request at a time: behind the PDF pages it reads again, the first task can wait minutes.
  const settled = await eventually(async () => {
    made = (await gql('query ($id: UUID!) { aiArtifact(id: $id) { status fromPublishedVersion cards { type } error } }', { id: artifactId }, B.token)).aiArtifact
    return made.status === 'READY' || made.status === 'FAILED'
  }, 360_000)
  ok(settled && made.status === 'READY' && made.fromPublishedVersion && made.cards.length > 0 && made.cards.every((c) => c.type === 'flashcard'), 'the worker makes them with the real model, from the published version', made?.error ?? `${made?.cards?.length ?? 0} cards`)
  const kept = await gql('mutation ($input: KeepAiCardsInput!) { keepAiCards(input: $input) { noteId userErrors { message } } }', { input: { artifactId, cardIndexes: [0], into: 'NEW_NOTE' } }, B.token)
  const keptId = kept.keepAiCards.noteId
  const theirs = keptId ? (await gql('query ($id: UUID!) { note(id: $id) { viewerAccess visibility cards(first: 10) { edges { node { type } } } } }', { id: keptId }, B.token)).note : null
  ok(keptId !== id && theirs?.viewerAccess === 'OWNER' && theirs.visibility === 'PRIVATE' && theirs.cards.edges.length === 1, 'B keeps one as a private note of their own', kept.keepAiCards.userErrors[0]?.message)
  const asA = (await gql('query ($id: UUID!) { note(id: $id) { publishedVersion { number } aiArtifacts { id } } }', { id }, A.token)).note
  ok(asA.publishedVersion?.number === 1 && asA.aiArtifacts.length === 0, "A's note keeps its version, and A sees none of B's results")
  const used = (await gql('{ myAiAllowance { usedToday limitToday } }', {}, B.token)).myAiAllowance
  ok(used.usedToday > 0, "the model's tokens count against B's day", `${used.usedToday} of ${used.limitToday ?? 'no limit'}`)
  // Ask AI (ADR-0060): the worker embeds the published version; B asks public notes and the answer cites A's note.
  const embedded = opt('--vm') ? await eventually(async () => /\b[1-9]\d*\b/.test(sql(`SELECT count(*) FROM notes.\\"NoteChunk\\" WHERE \\"noteId\\" = '${id}'`).toString().split('\n')[2] ?? ''), 120_000) : true
  ok(embedded, "the worker embeds A's published note for Ask AI")
  const question = await gql('mutation ($input: AskAiInput!) { askAi(input: $input) { answer { id status } userErrors { message } } }', { input: { question: `What does a heap keep on top? ${WORD}`, scope: 'PUBLIC' } }, B.token)
  const answerId = question.askAi.answer?.id
  let answered
  await eventually(async () => {
    answered = (await gql('query ($id: UUID!) { aiAnswer(id: $id) { status text sources { noteId versionId } error } }', { id: answerId }, B.token)).aiAnswer
    return answered.status === 'READY' || answered.status === 'FAILED'
  }, 180_000)
  ok(answered?.status === 'READY' && answered.text.length > 0 && answered.sources.some((s) => s.noteId === id && s.versionId), "B asks AI over public notes: the real model answers, citing A's note", answered?.error ?? question.askAi.userErrors[0]?.message ?? `${answered?.sources?.length ?? 0} sources`)

  // Study aids (ADR-0061): going PUBLIC queued five for A's note; the worker makes them as the platform's work, A
  // follows their progress, and anyone reads the READY ones.
  let progress
  await eventually(async () => {
    progress = (await gql('query ($id: UUID!) { note(id: $id) { noteProcessingStatus { done steps { task status } } } }', { id }, A.token)).note.noteProcessingStatus
    return progress?.done === true
  }, 300_000)
  ok(progress?.done && progress.steps.length === 5, "the worker makes A's public note its five study aids", progress?.steps.map((s) => `${s.task}:${s.status}`).join(' '))
  const aids = (await gql('query ($id: UUID!) { note(id: $id) { aiInsights { task status markdown } } }', { id })).note.aiInsights
  ok(aids.some((a) => a.task === 'SUMMARIZE' && a.status === 'READY' && a.markdown), 'anyone reads its summary, signed in or not', aids.map((a) => a.task).join(' '))
} else {
  console.log(`# AI is off here (${aiStatus.reason}): AI tasks not checked`)
}

// A second version, and the page follows.
await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId: id, title: `Binary heaps ${WORD}` } }, A.token)
const v2 = await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { publishedVersion { number } slug } } }', { input: { noteId: id } }, A.token)
ok(v2.publishNote.note.publishedVersion.number === 2, 'A publishes version 2')
const path2 = `/n/${v2.publishNote.note.slug}-${id}`
ok(await eventually(async () => (await page(path2)).body.includes('Binary heaps')), 'the public page shows version 2', path2)
ok(await eventually(async () => [301, 308].includes((await page(path)).status)), 'the old address moves to the new one')

// Private again.
await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { visibility } } }', { input: { noteId: id, visibility: 'PRIVATE' } }, A.token)
ok(!(await savedNoteIds(B.token)).includes(id), 'made private, it leaves B\'s Saved')
if (trended) ok(!(await gql('{ trendingFeed(first: 100) { edges { node { id } } } }', {}, A.token)).trendingFeed.edges.some((e) => e.node?.id === id), 'and it leaves Trending')
if (trended) ok(await eventually(async () => (await myPoints(A.token)).reduce((s, e) => s + e.delta, 0) === 0), 'and A\'s point for it is taken back')
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
// Kinds from the phone (ADR-0052): a project starts offline and the pull brings its kind back; a blog needs a teacher.
const project = newId()
const blog = newId()
const kinds = await gql('mutation ($ops: [SyncOpInput!]!) { syncPush(ops: $ops) { results { status code } } }', { ops: [{ clientOpId: newId(), kind: 'CREATE_NOTE', noteId: project, title: 'Rover', noteKind: 'PROJECT' }, { clientOpId: newId(), kind: 'CREATE_NOTE', noteId: blog, title: 'My blog', noteKind: 'BLOG' }] }, A.token)
const kindPull = await gql('query { syncPull(first: 50) { notes { note { id kind folder { id } tags { name } } } } }', {}, A.token)
ok(kinds.syncPush.results.map((r) => r.status).join() === 'APPLIED,REJECTED' && kindPull.syncPull.notes.find((x) => x.note.id === project)?.note.kind === 'PROJECT', "A's phone starts a project offline and pulls its kind back; a blog is refused until A teaches", JSON.stringify(kinds.syncPush.results))

// Trash and back.
await gql('mutation ($input: NoteIdInput!) { deleteNote(input: $input) { note { id } } }', { input: { noteId: id } }, A.token)
const trashed = await gql('query { myNotes(filter: { trashed: true }) { edges { node { id } } } }', {}, A.token)
ok(trashed.myNotes.edges.some((e) => e.node.id === id), 'A moves it to the trash')
await gql('mutation ($input: NoteIdInput!) { restoreNote(input: $input) { note { id } } }', { input: { noteId: id } }, A.token)
const restored = await gql('query ($id: UUID!) { note(id: $id) { deletedAt cards { edges { node { id } } } } }', { id }, A.token)
ok(restored.note.deletedAt === null && restored.note.cards.edges.length === 3, 'and restores it with its three cards')

// People (ADR-0043): A follows B and B is told; B blocks A, which ends the follow and stops A sharing with B.
const person = (mutation) => gql(`mutation ($input: PersonInput!) { ${mutation}(input: $input) { user { id relation { following } } userErrors { message } } }`, { input: { userId: B.id } }, A.token)
const followed = await person('followUser')
ok(followed.followUser.user?.relation?.following === true, 'A follows B', followed.followUser.userErrors[0]?.message)
ok(await eventually(async () => (await gql('{ notifications(first: 1) { edges { node { category actor { id } } } } }', {}, B.token)).notifications.edges[0]?.node.category === 'FOLLOW'), 'B is told A follows them')
await gql('mutation ($input: PersonInput!) { blockUser(input: $input) { userErrors { message } } }', { input: { userId: A.id } }, B.token)
const afterBlock = await gql('query ($h: String!) { userByHandle(handle: $h) { relation { following blocked viewerCan { follow } } } }', { h: B.id }, A.token)
ok(afterBlock.userByHandle.relation.following === false && afterBlock.userByHandle.relation.blocked === false && afterBlock.userByHandle.relation.viewerCan.follow === false, 'B blocks A: the follow ends, A cannot follow again and is not shown the block')
const blockedShare = await gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { userErrors { message } } }', { input: { noteId: id, person: B.handle, role: 'EDITOR' } }, A.token).catch((e) => e.message)
ok(String(blockedShare).includes("can't be shared"), 'and A can no longer share with B', String(blockedShare))

// Teachers (ADR-0044), on the local environment where roles can be set: A and a new teacher C connect; A shares a note
// with all connections and C reads it, until the connection ends.
if (opt('--vm')) {
  const C = await signUp('c')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'TEACHER', \\"globalRole\\" = 'TEACHER' WHERE id IN ('${A.id}', '${C.id}')`)
  await gql('mutation ($input: PersonInput!) { requestConnection(input: $input) { userErrors { message } } }', { input: { userId: C.id } }, A.token)
  const asked = (await gql('{ myConnectionRequests { id direction person { id } } }', {}, C.token)).myConnectionRequests.find((r) => r.person.id === A.id && r.direction === 'INCOMING')
  await gql('mutation ($input: RespondToConnectionRequestInput!) { respondToConnectionRequest(input: $input) { userErrors { message } } }', { input: { requestId: asked.id, accept: true } }, C.token)
  ok((await gql('{ myConnections { node { id } } }', {}, A.token)).myConnections.some((e) => e.node.id === C.id), 'two teachers connect: one asks, the other accepts')
  const plan = await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `Lesson plan ${WORD}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: text('Graphs before trees.') }] } }, A.token)
  const planId = plan.createNote.note.id
  await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: planId } }, A.token)
  await gql('mutation ($input: SetNoteSharedWithConnectionsInput!) { setNoteSharedWithConnections(input: $input) { note { id } } }', { input: { noteId: planId, shared: true } }, A.token)
  const cReads = async () => (await gql('query ($id: UUID!) { note(id: $id) { id } }', { id: planId }, C.token)).note?.id === planId
  ok(await cReads(), 'A shares a note with all connections, and C reads it')
  await gql('mutation ($input: PersonInput!) { removeConnection(input: $input) { userErrors { message } } }', { input: { userId: C.id } }, A.token)
  ok(await eventually(async () => !(await cReads())), 'the connection ends, and C no longer reads it')

  // Groups (ADR-0045): A starts a private group; C asks to join with its link and A lets them in; a note shared to the
  // group is read by C and not by B, who is not in it.
  const created = await gql('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } userErrors { message } } }', { input: { name: `Study ${WORD}`, privacy: 'PRIVATE' } }, A.token)
  const groupId = created.createGroup.group.id
  await gql('mutation ($input: RequestToJoinGroupInput!) { requestToJoinGroup(input: $input) { group { id } } }', { input: { groupId, message: 'I teach this too' } }, C.token)
  const pending = (await gql('query ($id: UUID!) { group(id: $id) { joinRequests { id user { id } } } }', { id: groupId }, A.token)).group.joinRequests
  await gql('mutation ($input: ReviewGroupJoinRequestInput!) { reviewGroupJoinRequest(input: $input) { group { id } } }', { input: { requestId: pending[0].id, decision: 'APPROVED' } }, A.token)
  ok((await gql('query ($id: UUID!) { group(id: $id) { viewerRole } }', { id: groupId }, C.token)).group.viewerRole === 'MEMBER', 'a private group: C asks to join with its link, A lets them in')
  await gql('mutation ($input: NoteGroupInput!) { shareNoteToGroup(input: $input) { note { id } } }', { input: { noteId: planId, groupId } }, A.token)
  const readsPlan = async (who) => (await gql('query ($id: UUID!) { note(id: $id) { id } }', { id: planId }, who.token)).note?.id === planId
  ok(await eventually(() => readsPlan(C)), 'a note shared to the group is read by its members')
  const outside = await gql('query ($id: UUID!) { group(id: $id) { name posts { edges { node { id } } } sharedNotes { edges { node { id } } } } }', { id: groupId }, B.token)
  ok(!(await readsPlan(B)) && outside.group.posts === null && outside.group.sharedNotes === null, 'and not by B, who is not in it: B sees the name only')
  // The group's picture (ADR-0076): A, its admin, uploads one and sets it; C, a member, sees it from storage.
  {
    const bytes = png(640, 360)
    const r = await gql('mutation ($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { fileId uploadUrl uploadHeaders { name value } } userErrors { message } } }', { input: { fileName: 'group.png', mimeType: 'image/png', sizeBytes: bytes.length, purpose: 'GROUP_PICTURE' } }, A.token)
    const intent = r.createUploadIntent.intent
    const put = intent ? await fetch(intent.uploadUrl, { method: 'PUT', headers: Object.fromEntries(intent.uploadHeaders.map((h) => [h.name, h.value])), body: bytes }) : null
    if (intent) await gql('mutation ($id: UUID!) { completeUpload(fileId: $id) { ok } }', { id: intent.fileId }, A.token)
    const set = intent ? (await gql('mutation ($input: UpdateGroupInput!) { updateGroup(input: $input) { group { pictureUrl } userErrors { message } } }', { input: { groupId, pictureFileId: intent.fileId } }, A.token)).updateGroup : null
    const seen = (await gql('query ($id: UUID!) { group(id: $id) { pictureUrl } }', { id: groupId }, C.token)).group.pictureUrl
    const served = seen ? await fetch(seen) : null
    ok(!!put?.ok && !!set?.group?.pictureUrl && served?.ok === true && (served.headers.get('content-type') ?? '').startsWith('image/'), 'the group’s admin sets its picture; a member sees it, served from storage', set?.userErrors[0]?.message ?? r.createUploadIntent.userErrors[0]?.message)
  }

  // Classrooms (ADR-0046): teacher A starts a class; student D asks with its code and A lets them in; A's
  // announcement reaches D; a note shared to the class is read by D and not by B; A and C, who are no longer connected,
  // share again once C is the class's TA.
  const D = await signUp('d')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id = '${D.id}'`)
  const klass = (await gql('mutation { createClassroom(input: { name: "Lifecycle class" }) { classroom { id joinCode } userErrors { message } } }', {}, A.token)).createClassroom.classroom
  const classroomId = klass.id
  ok(/^[A-HJKMNP-Z2-9]{8}$/.test(klass.joinCode), 'teacher A starts a class with an eight-character code', klass.joinCode)
  const preview = (await gql('query ($code: String!) { classroomByCode(code: $code) { id name } }', { code: klass.joinCode.toLowerCase() }, D.token)).classroomByCode
  await gql('mutation ($input: RequestToJoinClassroomInput!) { requestToJoinClassroom(input: $input) { classroom { id } } }', { input: { code: klass.joinCode } }, D.token)
  ok(preview?.id === classroomId && (await eventually(async () => (await gql('{ notifications(first: 1) { edges { node { category classroom { id } } } } }', {}, A.token)).notifications.edges[0]?.node.classroom?.id === classroomId)), 'D finds the class by its code and asks; A is told')
  const asking = (await gql('query ($id: UUID!) { classroom(id: $id) { joinRequests { id } } }', { id: classroomId }, A.token)).classroom.joinRequests
  await gql('mutation ($input: ReviewClassroomJoinRequestInput!) { reviewClassroomJoinRequest(input: $input) { classroom { id } } }', { input: { requestId: asking[0].id, decision: 'APPROVED' } }, A.token)
  ok((await gql('query ($id: UUID!) { classroom(id: $id) { viewerRole members { role } } }', { id: classroomId }, D.token)).classroom.viewerRole === 'STUDENT', 'A lets D in; D is a student')
  // The class goal (ADR-0081): A turns it on; D sees the total, never the parts; A sees each part.
  const GOAL = 'query ($id: UUID!) { classroom(id: $id) { rhythmRing { goal { target progress automatic parts { countedDays } } } } }'
  const goalOn = (await gql('mutation ($input: SetClassGoalInput!) { setClassGoal(input: $input) { ok userErrors { message } } }', { input: { classroomId, on: true } }, A.token)).setClassGoal
  const seenByD = (await gql(GOAL, { id: classroomId }, D.token)).classroom.rhythmRing.goal
  const seenByA = (await gql(GOAL, { id: classroomId }, A.token)).classroom.rhythmRing.goal
  ok(goalOn.ok && seenByD?.automatic && seenByD.target >= 1 && seenByD.parts === null && seenByA?.parts?.length === 1, 'A sets a class goal: D sees its total, A each part', JSON.stringify({ goalOn, seenByD, seenByA }))
  await gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: text('Test on Friday').doc } }, A.token)
  ok(await eventually(async () => (await gql('{ notifications(first: 1) { edges { node { category } } } }', {}, D.token)).notifications.edges[0]?.node.category === 'CLASSROOM_POST'), 'A posts an announcement and D is told')
  await gql('mutation ($input: NoteClassroomInput!) { shareNoteToClassroom(input: $input) { note { id } } }', { input: { noteId: planId, classroomId } }, A.token)
  const closed = await gql('query ($id: UUID!) { classroom(id: $id) { name } }', { id: classroomId }, B.token)
  ok((await eventually(() => readsPlan(D))) && !(await readsPlan(B)) && closed.classroom === null, 'a note shared to the class is read by D, and B sees nothing of the class')
  C.handle = (await gql('{ viewer { handle } }', {}, C.token)).viewer.handle
  await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: C.handle, role: 'TA' } }, A.token)
  const invite = (await gql('{ myClassroomInvites { id role } }', {}, C.token)).myClassroomInvites[0]
  await gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } }, C.token)
  const coShare = async () => (await gql('mutation ($input: ShareNoteInput!) { shareNote(input: $input) { note { id } userErrors { message } } }', { input: { noteId: id, person: C.handle, role: 'VIEWER' } }, A.token).catch((e) => ({ error: e.message })))
  const shareResult = await eventually(async () => !!(await coShare()).shareNote?.note)
  ok(invite?.role === 'TA' && shareResult, 'C accepts A\'s TA invite; A shares with C again, as co-teachers')

  // Classroom quizzes (ADR-0064): A makes a quiz from the lesson plan with the real model (the AI QUIZ task, where AI
  // answers; by hand otherwise), publishes it to the class and D is told; D takes it, scored by the server, and sees
  // the answers; A sees that one student submitted.
  let questions = [{ question: text('Which comes first in the plan?').doc, choices: [{ id: 'c1', content: [{ type: 'text', text: 'Graphs' }] }, { id: 'c2', content: [{ type: 'text', text: 'Trees' }] }], correct: ['c1'], multiple: false }]
  const quizByAi = (await gql('{ aiStatus { available } }')).aiStatus.available
  if (quizByAi) {
    const asked = await gql('mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } userErrors { message } } }', { input: { noteId: planId, task: 'QUIZ' } }, A.token)
    let made
    await eventually(async () => {
      made = (await gql('query ($id: UUID!) { aiArtifact(id: $id) { status cards { type content } } }', { id: asked.runAiTask.artifact?.id }, A.token)).aiArtifact
      return made?.status === 'READY' || made?.status === 'FAILED'
    }, 180_000)
    if (made?.status === 'READY' && made.cards.length) questions = made.cards.map((c) => c.content)
  }
  const published = (await gql('mutation ($input: PublishClassQuizInput!) { publishClassQuiz(input: $input) { quiz { id questionCount } userErrors { message } } }', { input: { classroomId, title: `Lesson quiz ${WORD}`, questions, sourceNoteId: planId } }, A.token)).publishClassQuiz
  const quizId = published.quiz?.id
  ok(!!quizId && (await eventually(async () => (await gql('{ notifications(first: 1) { edges { node { category path } } } }', {}, D.token)).notifications.edges[0]?.node.path === `/classes/${classroomId}/quizzes/${quizId}`)), 'A publishes a quiz to the class and D is told', published.userErrors[0]?.message ?? `${published.quiz?.questionCount} question${published.quiz?.questionCount === 1 ? '' : 's'}${quizByAi ? ' made by the real model' : ''}`)
  const toTake = (await gql('query ($id: UUID!) { classQuiz(id: $id) { questions { id correct choices { id } } } }', { id: quizId }, D.token)).classQuiz
  const taken = (await gql('mutation ($input: SubmitQuizAttemptInput!) { submitQuizAttempt(input: $input) { attempt { score total } quiz { questions { correct } } userErrors { message } } }', { input: { quizId, clientOpId: newId(), answers: toTake.questions.map((q) => ({ questionId: q.id, choiceIds: [q.choices[0].id] })) } }, D.token)).submitQuizAttempt
  ok(toTake.questions.every((q) => q.correct === null) && taken.attempt?.total === toTake.questions.length && taken.quiz.questions.every((q) => q.correct?.length), 'D takes it without seeing the answers, is scored by the server, then sees them', taken.userErrors[0]?.message ?? `${taken.attempt?.score}/${taken.attempt?.total}`)
  ok((await gql('query ($id: UUID!) { classQuiz(id: $id) { submittedCount } }', { id: quizId }, A.token)).classQuiz.submittedCount === 1, 'A sees that one student has submitted')

  // Comments and reactions (ADR-0047): D, who reads the lesson plan through the class, comments and reacts; A is told
  // and replies, and D is told; B, who cannot read the note, sees no discussion.
  const planTarget = { type: 'NOTE', id: planId }
  const added = await gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } userErrors { message } } }', { input: { target: planTarget, body: text('Why graphs first?').doc } }, D.token)
  await gql('mutation ($input: ReactInput!) { react(input: $input) { reactions { viewerReaction } } }', { input: { target: { type: 'NOTE', id: planId }, kind: 'HELPFUL' } }, D.token)
  const told = async (who, kind) => (await gql('{ notifications(first: 5) { edges { node { category data note { id } } } } }', {}, who.token)).notifications.edges.some((e) => e.node.category === 'COMMENT' && e.node.data?.kind === kind && e.node.note?.id === planId)
  ok(!!added.addComment.comment && (await eventually(() => told(A, 'COMMENT'))), 'D comments on the lesson plan shared to the class; A is told', added.addComment.userErrors[0]?.message)
  await gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } } }', { input: { target: planTarget, parentId: added.addComment.comment.id, body: text('Trees are graphs.').doc } }, A.token)
  const thread = (await gql('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount reactions { counts { kind count } } } }', { target: planTarget }, A.token)).discussion
  const unseen = (await gql('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target: planTarget }, B.token)).discussion
  ok((await eventually(() => told(D, 'REPLY'))) && thread.commentCount === 2 && thread.reactions.counts.find((c) => c.kind === 'HELPFUL').count === 1 && unseen === null, 'A replies and D is told; A sees one Helpful; B sees no discussion')

  // Mentions (ADR-0054): A names C (the class's TA, who reads the plan) and B (who cannot) in a comment; only C is told.
  await gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } } }', { input: { target: planTarget, body: text(`@${C.handle} can you take this one? cc @${B.handle}`).doc } }, A.token)
  const mentioned = async (who) => (await gql('{ notifications(first: 10) { edges { node { category actor { id } note { id } } } } }', {}, who.token)).notifications.edges.some((e) => e.node.category === 'MENTION' && e.node.actor?.id === A.id && e.node.note?.id === planId)
  ok((await eventually(() => mentioned(C))) && !(await mentioned(B)), 'A mentions C and B in a comment on the plan: C, who reads it, is told; B, who cannot, is not')

  // Project workspaces (ADR-0048): D starts one and asks teacher C to mentor; D asks a doubt, C hears of it and
  // answers, and D hears back.
  const ws = (await gql('mutation { createGroup(input: { name: "Lifecycle project", privacy: PRIVATE, type: PROJECT }) { group { id type } userErrors { message } } }', {}, D.token)).createGroup.group
  await gql('mutation ($input: InviteMentorInput!) { inviteMentor(input: $input) { userErrors { message } } }', { input: { groupId: ws.id, person: C.handle } }, D.token)
  const mentorInvite = (await gql('{ myMentorInvites { id group { id } } }', {}, C.token)).myMentorInvites.find((i) => i.group.id === ws.id)
  await gql('mutation ($input: AnswerMentorInviteInput!) { answerMentorInvite(input: $input) { group { viewerRole } } }', { input: { inviteId: mentorInvite.id, accept: true } }, C.token)
  ok(ws.type === 'PROJECT' && (await gql('query ($id: UUID!) { group(id: $id) { viewerRole } }', { id: ws.id }, C.token)).group.viewerRole === 'MENTOR', 'D starts a project workspace; teacher C accepts the invite to mentor it')
  const doubt = (await gql('mutation ($input: AskDoubtInput!) { askDoubt(input: $input) { doubt { id } userErrors { message } } }', { input: { groupId: ws.id, title: 'Why a min-heap?', body: text('For the scheduler').doc } }, D.token)).askDoubt.doubt
  const toldOf = async (who, kind) => (await gql('{ notifications(first: 5) { edges { node { category data path } } } }', {}, who.token)).notifications.edges.some((e) => e.node.category === 'DOUBT' && e.node.data?.kind === kind && e.node.path.endsWith(doubt.id))
  ok(await eventually(() => toldOf(C, 'ASKED')), 'D asks a doubt and the mentor is told')
  const answered = (await gql('mutation ($input: AnswerDoubtInput!) { answerDoubt(input: $input) { doubt { status answers { byMentor } } } }', { input: { doubtId: doubt.id, body: text('The smallest job runs first.').doc } }, C.token)).answerDoubt.doubt
  ok(answered.status === 'ANSWERED' && answered.answers[0].byMentor && (await eventually(() => toldOf(D, 'ANSWERED'))), 'the mentor answers and D is told')

  // Feeds (ADR-0049): D follows teacher A, who publishes a blog; it is in D's Following feed. C's activity shows the
  // doubt D asked in the workspace C mentors.
  await gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: A.id } }, D.token)
  const blogId = (await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `Why heaps ${WORD}`, kind: 'BLOG', cards: [{ id: newId(), type: 'text', position: 'a0', content: text('Priority queues everywhere.') }] } }, A.token)).createNote.note.id
  await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: blogId } }, A.token)
  await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: blogId, visibility: 'PUBLIC' } }, A.token)
  const feed = (await gql('{ followingFeed(first: 20) { edges { node { id owner { id } visibility } } } }', {}, D.token)).followingFeed.edges.map((e) => e.node)
  ok(feed[0]?.id === blogId && feed.every((n) => n.owner.id === A.id && n.visibility === 'PUBLIC'), 'D follows A; A\'s new public blog leads D\'s Following feed', `${feed.length} notes`)
  const activity = (await gql('{ activityFeed(first: 20) { edges { node { kind doubt { id } note { id } } } } }', {}, C.token)).activityFeed.edges.map((e) => e.node)
  ok(activity.some((i) => i.kind === 'DOUBT' && i.doubt?.id === doubt.id), 'C\'s activity feed shows the doubt D asked in the workspace C mentors')

  // Scoped moderation (ADR-0051): D's flagged comment on A's announcement waits for the class's staff and TA C removes
  // it. In D's workspace, mentor C reports and hides a post of D's; D appeals once, into the same queue, and C puts it
  // back. B cannot report what B cannot see.
  const announcementId = (await gql('query ($id: UUID!) { classroom(id: $id) { posts(first: 1) { edges { node { id } } } } }', { id: classroomId }, D.token)).classroom.posts.edges[0].node.id
  const annTarget = { type: 'CLASSROOM_POST', id: announcementId }
  const heldComment = (await gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id moderation } userErrors { message } } }', { input: { target: annTarget, body: text('Buy followers here, cheap.').doc } }, D.token)).addComment.comment
  const queueOf = async (who, scope) => (await gql('query ($scope: ModerationScopeInput) { moderationQueue(scope: $scope) { edges { node { entityId appeal { message } reports { reporter { id } } } } } }', { scope }, who.token)).moderationQueue.edges.map((e) => e.node)
  const classQueue = await queueOf(C, { scope: 'CLASSROOM', id: classroomId })
  ok(heldComment?.moderation === 'PENDING_REVIEW' && classQueue.some((c) => c.entityId === heldComment.id && c.reports[0]?.reporter === null), 'D\'s flagged comment on the announcement is held, in the class\'s queue for its staff')
  const decide = (who, input) => gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok userErrors { message } } }', { input }, who.token).catch((e) => ({ error: e.message }))
  await decide(C, { entityType: 'COMMENT', entityId: heldComment.id, action: 'REMOVE', reason: 'No selling in class.' })
  const moderated = async (who, kind, entityType) => (await gql('{ notifications(first: 5) { edges { node { category data } } } }', {}, who.token)).notifications.edges.some((e) => e.node.category === 'MODERATION' && e.node.data?.kind === kind && e.node.data?.entityType === entityType)
  const dSees = (await gql('query ($target: CommentTargetInput!) { discussion(target: $target) { comments { edges { node { id moderation moderationReason } } } } }', { target: annTarget }, D.token)).discussion.comments.edges.map((e) => e.node)
  const aSees = (await gql('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target: annTarget }, A.token)).discussion
  ok((await eventually(() => moderated(D, 'REMOVED', 'COMMENT'))) && dSees.some((c) => c.id === heldComment.id && c.moderation === 'REMOVED' && c.moderationReason === 'No selling in class.') && aSees.commentCount === 0, 'TA C removes it with a reason: D is told and reads why; A sees nothing')

  const wsPost = (await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } userErrors { message } } }', { input: { groupId: ws.id, body: text('Nobody else does any work here.').doc } }, D.token)).createGroupPost.post
  await gql('mutation ($input: ReportContentInput!) { reportContent(input: $input) { ok } }', { input: { entityType: 'GROUP_POST', entityId: wsPost.id, reason: 'HARASSMENT' } }, C.token)
  const own = await decide(D, { entityType: 'GROUP_POST', entityId: wsPost.id, action: 'DISMISS' })
  ok((await queueOf(D, { scope: 'GROUP', id: ws.id })).some((c) => c.entityId === wsPost.id) && /own content/.test(own.error ?? ''), 'C reports a post D wrote in the workspace: it is in the workspace\'s queue, and D cannot decide on it')
  await decide(C, { entityType: 'GROUP_POST', entityId: wsPost.id, action: 'HIDE', reason: 'Keep it about the project.' })
  const postsOf = async (who) => (await gql('query ($id: UUID!) { group(id: $id) { posts { edges { node { id moderation } } } } }', { id: ws.id }, who.token)).group.posts.edges.map((e) => e.node)
  ok((await eventually(() => moderated(D, 'HIDDEN', 'GROUP_POST'))) && !(await postsOf(C)).some((p) => p.id === wsPost.id) && (await postsOf(D)).some((p) => p.id === wsPost.id && p.moderation === 'HIDDEN'), 'mentor C hides it: D is told, and only D still sees it')
  await gql('mutation ($input: AppealModerationInput!) { appealModeration(input: $input) { ok } }', { input: { entityType: 'GROUP_POST', entityId: wsPost.id, message: 'I was frustrated; I take it back.' } }, D.token)
  const appealed = (await queueOf(C, { scope: 'GROUP', id: ws.id })).find((c) => c.entityId === wsPost.id)
  await decide(C, { entityType: 'GROUP_POST', entityId: wsPost.id, action: 'APPROVE' })
  ok(appealed?.appeal?.message === 'I was frustrated; I take it back.' && (await eventually(() => moderated(D, 'RESTORED', 'GROUP_POST'))) && (await postsOf(C)).some((p) => p.id === wsPost.id), 'D appeals into the same queue; C puts the post back and D is told')
  // A private group shows its name to anyone with the link, so B may report the group itself, to the platform; what
  // is inside stays out of B's reach.
  const unseenPost = await gql('mutation ($input: ReportContentInput!) { reportContent(input: $input) { ok userErrors { code } } }', { input: { entityType: 'GROUP_POST', entityId: wsPost.id, reason: 'SPAM' } }, B.token)
  ok(unseenPost.reportContent.userErrors[0]?.code === 'NOT_FOUND', 'B cannot report a post in the private workspace B is not in')

  // Account standing (ADR-0053): a platform admin suspends D for a day; D reads why, can no longer post, appeals once;
  // the admin lifts it and D posts again.
  const admin = await signUp('admin')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL', \\"globalRole\\" = 'PLATFORM_ADMIN' WHERE id = '${admin.id}'`)
  await decide(admin, { entityType: 'USER', entityId: D.id, action: 'SUSPEND', reason: 'Posting the same link everywhere.', suspendDays: 1 })
  const standing = (await gql('{ myStanding { suspendedUntil suspensionReason canAppeal } }', {}, D.token)).myStanding
  const refused = await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId: ws.id, body: text('Still here').doc } }, D.token).catch((e) => e.message)
  ok(!!standing.suspendedUntil && standing.suspensionReason === 'Posting the same link everywhere.' && standing.canAppeal && /suspended until/.test(String(refused)), 'a platform admin suspends D: D reads until when and why, and posting says it is the suspension', String(refused))
  await gql('mutation ($input: AppealModerationInput!) { appealModeration(input: $input) { ok } }', { input: { entityType: 'USER', entityId: D.id, message: 'It was for the class.' } }, D.token)
  const appealedCase = (await gql('{ moderationQueue(first: 100) { edges { node { entityId suspendedUntil appeal { message } } } } }', {}, admin.token)).moderationQueue.edges.find((e) => e.node.entityId === D.id)?.node
  await decide(admin, { entityType: 'USER', entityId: D.id, action: 'APPROVE' })
  const back = await gql('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } userErrors { message } } }', { input: { groupId: ws.id, body: text('Back again').doc } }, D.token).catch((e) => ({ error: e.message }))
  const posted = back.createGroupPost?.post
  const toldLifted = await eventually(() => moderated(D, 'RESTORED', 'USER'))
  ok(appealedCase?.appeal?.message === 'It was for the class.' && !!appealedCase.suspendedUntil && !!posted && toldLifted, 'D appeals once, the admin lifts the suspension, D is told and posts again', JSON.stringify({ appealedCase, back, toldLifted }))
  // Weekly contests (ADR-0082): the admin writes and publishes one that is open now; B takes it, sees no answer key
  // while answering, and every answer explained once it is submitted.
  {
    const now = Date.now()
    const questions = [1, 2, 3].map((n) => ({ prompt: `Lifecycle question ${n}?`, choices: ['Right', 'Wrong'], correct: 0, explanation: `Because ${n}.` }))
    const saved = (await gql('mutation ($input: ContestInput!) { saveContest(input: $input) { contest { id } userErrors { message } } }', { input: { title: `Lifecycle contest ${WORD}`, opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString(), minutes: 10, questionCount: 3, questions } }, admin.token)).saveContest
    const published = (await gql('mutation ($input: ContestIdInput!) { publishContest(input: $input) { contest { published } userErrors { message } } }', { input: { id: saved.contest?.id } }, admin.token)).publishContest
    const ATTEMPT = 'viewerAttempt { id finished score total questions { id choices { id text } correctChoiceId explanation } }'
    const started = (await gql(`mutation ($input: StartContestInput!) { startContest(input: $input) { contest { state ${ATTEMPT} } userErrors { message } } }`, { input: { contestId: saved.contest?.id } }, B.token)).startContest.contest?.viewerAttempt
    for (const q of started?.questions ?? []) await gql('mutation ($input: AnswerContestQuestionInput!) { answerContestQuestion(input: $input) { userErrors { message } } }', { input: { attemptId: started.id, questionId: q.id, choiceId: q.choices.find((c) => c.text === 'Right').id } }, B.token)
    const done = (await gql(`mutation ($input: ContestAttemptIdInput!) { submitContest(input: $input) { contest { ${ATTEMPT} } } }`, { input: { attemptId: started?.id } }, B.token)).submitContest.contest?.viewerAttempt
    ok(published.contest?.published && started?.questions.length === 3 && started.questions.every((q) => q.correctChoiceId === null) && done?.finished && done.score === 3 && done.questions.every((q) => q.explanation), 'the admin publishes a contest; B takes it without the answer key, and sees every answer explained after', JSON.stringify({ saved: saved.userErrors, published: published.userErrors, score: done?.score }))
  }
}

// Media (ADR-0041): processed after the upload by the worker, scanned by the environment's ClamAV.
let uploads = 0
const uploadTo = async (mimeType, fileName, bytes) => {
  const r = await gql('mutation ($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { fileId uploadUrl uploadHeaders { name value } } userErrors { message } } }', { input: { fileName, mimeType, sizeBytes: bytes.length, purpose: 'ATTACHMENT', parentId: id } }, A.token)
  const intent = r.createUploadIntent.intent
  if (!intent) throw new Error(r.createUploadIntent.userErrors[0]?.message)
  const put = await fetch(intent.uploadUrl, { method: 'PUT', headers: Object.fromEntries(intent.uploadHeaders.map((h) => [h.name, h.value])), body: bytes })
  if (!put.ok) throw new Error(`PUT: HTTP ${put.status}`)
  await gql('mutation ($id: UUID!) { completeUpload(fileId: $id) { ok } }', { id: intent.fileId }, A.token)
  const image = mimeType.startsWith('image/')
  await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }', { input: { noteId: id, ops: [{ kind: 'UPSERT', id: newId(), type: image ? 'image' : 'file', position: `a${3 + uploads++}`, content: image ? { fileId: intent.fileId, alt: fileName } : { fileId: intent.fileId } }] } }, A.token)
  return intent.fileId
}
const mediaOf = async (fileId) => {
  const { note } = await gql('query ($id: UUID!) { note(id: $id) { cards { edges { node { content media { url width thumbUrl mediumUrl largeUrl } } } } } }', { id }, A.token)
  return note.cards.edges.find((e) => e.node.content?.fileId === fileId)?.node.media ?? null
}
const picture = await uploadTo('image/png', 'board.png', png(1200, 800))
let shown
const sized = await eventually(async () => !!(shown = await mediaOf(picture))?.largeUrl, 120_000)
const widths = sized ? await Promise.all([shown.thumbUrl, shown.mediumUrl, shown.largeUrl].map(async (u) => webpWidth(Buffer.from(await (await fetch(u)).arrayBuffer())))) : []
ok(sized && widths.join() === '320,960,1200', 'a picture on the note gets three WebP sizes, never enlarged', widths.join(' '))
const infected = await uploadTo('application/pdf', 'invoice.pdf', EICAR_PDF)
const before = await mediaOf(infected)
ok(await eventually(async () => (await mediaOf(infected)) === null, 120_000), 'an infected file is quarantined: its card shows it unavailable')
ok(before !== null && !(await fetch(before.url)).ok, 'and its old read URL no longer serves it')

// The AI stages of PDF conversion (ADR-0063), where AI answers: a scanned Hindi page the OCR cannot read goes to the
// vision model, whose reading becomes the converted note's cards; and clean-up mends a note's broken words, which A
// applies.
if (aiStatus.available) {
  const scan = await uploadTo('application/pdf', 'hindi-scan.pdf', readFileSync(new URL('../workers/pdf-engine/tests/fixtures/hindi-scan.pdf', import.meta.url)))
  let conversion
  // The file is checked for malware before it can be converted.
  await eventually(async () => {
    conversion = (await gql('mutation ($input: ConvertPdfInput!) { convertPdfToNote(input: $input) { conversion { id } userErrors { message } } }', { input: { noteId: id, fileId: scan } }, A.token)).convertPdfToNote.conversion
    return !!conversion
  }, 120_000)
  let converted
  await eventually(async () => {
    converted = (await gql('query ($id: UUID!) { pdfConversion(id: $id) { status aiPages aiRejected cards error note { id } } }', { id: conversion?.id }, A.token)).pdfConversion
    return converted?.status === 'DONE' || converted?.status === 'FAILED'
  }, 300_000)
  ok(converted?.status === 'DONE' && converted.aiPages === 1 && converted.aiRejected === 0, 'a scanned Hindi page the OCR cannot read is read again by the vision model', converted?.error ?? `${converted?.aiPages} read, ${converted?.aiRejected} set aside`)
  const hindi = converted?.note ? (await gql('query ($id: UUID!) { note(id: $id) { cards(first: 20) { edges { node { content } } } } }', { id: converted.note.id }, A.token)).note.cards.edges.map((e) => JSON.stringify(e.node.content)).join(' ') : ''
  ok(hindi.includes('सूर्य') && hindi.includes('"page":1'), 'its cards hold the Hindi words, anchored to the page')

  const broken = await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } userErrors { message } } }', { input: { title: `Respiration ${WORD}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: text('Respiration releases the en- ergy stored in glucose.') }, { id: newId(), type: 'text', position: 'a1', content: text('Cells use tbis energy to grow, move 14 Biology Class X and repair themselves.') }] } }, A.token)
  const brokenId = broken.createNote.note.id
  const cleanRun = await gql('mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } userErrors { message } } }', { input: { noteId: brokenId, task: 'CLEAN_UP' } }, A.token)
  let cleaned
  await eventually(async () => {
    cleaned = (await gql('query ($id: UUID!) { aiArtifact(id: $id) { status changes { cardId after } error } }', { id: cleanRun.runAiTask.artifact?.id }, A.token)).aiArtifact
    return cleaned?.status === 'READY' || cleaned?.status === 'FAILED'
  }, 180_000)
  ok(cleaned?.status === 'READY' && cleaned.changes.length > 0, 'clean-up proposes repairs of the broken words with the real model', cleaned?.error ?? cleanRun.runAiTask.userErrors[0]?.message ?? `${cleaned?.changes?.length ?? 0} changes`)
  const applied = cleaned?.changes?.length ? (await gql('mutation ($input: ApplyAiChangesInput!) { applyAiChanges(input: $input) { applied userErrors { message } } }', { input: { artifactId: cleanRun.runAiTask.artifact.id, cardIds: cleaned.changes.map((c) => c.cardId) } }, A.token)).applyAiChanges : null
  const mended = (await gql('query ($id: UUID!) { note(id: $id) { cards(first: 10) { edges { node { content } } } } }', { id: brokenId }, A.token)).note.cards.edges.map((e) => JSON.stringify(e.node.content)).join(' ')
  ok(applied?.applied.length === cleaned?.changes.length && mended.includes('the energy stored') && !mended.includes('en- ergy'), 'A applies them: the note’s cards are mended', applied?.userErrors[0]?.message)
}

// The monthly AI budget breaker (ADR-0058, Phase 5 exit), on the local environment (--vm): a month's spend over the
// budget pauses AI for everyone, with words for the person; the same spend in last month's books does not count, and
// AI answers again. The local model costs nothing, so the spend is written to the books directly.
if (opt('--vm') && (await gql('{ aiStatus { available } }')).aiStatus.available) {
  const spendId = newId()
  sql(`INSERT INTO ai.\\"AiUsage\\" (id, task, provider, model, \\"promptTokens\\", \\"completionTokens\\", \\"costMicroUsd\\", \\"latencyMs\\", ok) VALUES ('${spendId}', 'LIFECYCLE_BUDGET', 'OLLAMA', 'gemma4', 0, 0, 2000000000, 0, true)`)
  // Each API instance and the worker look at the month's spend once a minute.
  let refused
  const paused = await eventually(async () => {
    refused = await gql('mutation ($input: RunAiTaskInput!) { runAiTask(input: $input) { artifact { id } userErrors { message } } }', { input: { noteId: id, task: 'SUMMARIZE' } }, A.token).catch((e) => ({ error: e.message }))
    return (await gql('{ aiStatus { reason } }')).aiStatus.reason === 'BUDGET' && /budget/.test(JSON.stringify(refused))
  }, 150_000)
  ok(paused, 'a month’s spend over the budget pauses AI, saying why', JSON.stringify(refused)?.slice(0, 120))
  sql(`UPDATE ai.\\"AiUsage\\" SET \\"createdAt\\" = date_trunc('month', now()) - interval '1 day' WHERE id = '${spendId}'`)
  // The entrance takes turns between the two API instances: both answer again.
  const answering = async () => (await gql('{ aiStatus { available } }')).aiStatus.available
  ok(await eventually(async () => (await answering()) && (await answering()), 150_000), 'last month’s spend does not count: AI answers again')
}

// Learning events (ADR-0067, Phase 6): a batch counts once however often it is sent; time lands on A's day in their
// time zone; the server records A's note; the coming months' partitions exist (--vm).
{
  const now = new Date().toISOString()
  const batch = [
    { id: newId(), type: 'TIME_SPENT', durationMs: 660_000, metadata: { activity: 'FOCUS' }, clientTs: now, platform: 'WEB' },
    { id: newId(), type: 'NOTE_OPENED', entityType: 'NOTE', entityId: id, clientTs: now, platform: 'WEB' },
  ]
  const TRACK = 'mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted duplicates rejected { index message } } }'
  const first = (await gql(TRACK, { input: { events: batch, timeZone: 'Asia/Kolkata' } }, A.token)).trackEvents
  const again = (await gql(TRACK, { input: { events: batch, timeZone: 'Asia/Kolkata' } }, A.token)).trackEvents
  ok(first.accepted === 2 && again.accepted === 0 && again.duplicates === 2, 'learning events count once, however often a batch is sent', JSON.stringify([first, again]))
  if (opt('--vm')) {
    const value = (statement) => execFileSync(opt('--vm'), ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -tAc "${statement}"`], { stdio: 'pipe' }).toString().trim()
    const learning = Number(value(`SELECT coalesce(sum(\\"learningSeconds\\"), 0) FROM core.\\"LearningDay\\" WHERE \\"userId\\" = '${A.id}'`))
    const created = Number(value(`SELECT count(*) FROM learning.\\"LearningEvent\\" WHERE \\"userId\\" = '${A.id}' AND type = 'NOTE_CREATED'`))
    ok(learning >= 660 && created >= 1, 'the focus time is on A’s day, and the server recorded the notes A created', `${learning} s, ${created} NOTE_CREATED`)
    const partitions = Number(value(`SELECT count(*) FROM pg_inherits WHERE inhparent = 'learning.\\"LearningEvent\\"'::regclass`))
    ok(partitions >= 5, 'learning events have this month’s and the next three months’ partitions', `${partitions} partitions`)
  }
}

// Learning history and flashcard reviews (ADR-0067, ADR-0068): A's day is in the history with the focus time; a
// flashcard of A's own is in today's queue, a grade takes it out, and the day counts the review.
{
  const history = (await gql('{ learningHistory(days: 3) { days { day learningSeconds counted } } }', {}, A.token)).learningHistory
  ok(history.days.some((d) => d.learningSeconds >= 660 && d.counted), 'A’s history shows the day with its focus time, counting for Rhythm', JSON.stringify(history.days[0]))
  const front = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `What does a heap keep on top? ${WORD}` }] }] }
  const back = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The smallest item.' }] }] }
  const cardId = newId()
  await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `Cards ${WORD}`, cards: [{ id: cardId, type: 'flashcard', position: 'a0', content: { front, back } }] } }, A.token)
  const QUEUE = '{ reviewQueue { cards { cardId } doneToday } }'
  const before = (await gql(QUEUE, {}, A.token)).reviewQueue
  const graded = (await gql('mutation ($input: ReviewCardInput!) { reviewCard(input: $input) { review { state due } userErrors { message } } }', { input: { cardId, rating: 'EASY', clientOpId: newId(), durationMs: 5000 } }, A.token)).reviewCard
  const after = (await gql(QUEUE, {}, A.token)).reviewQueue
  ok(before.cards.some((c) => c.cardId === cardId) && graded.review?.state === 'REVIEW' && !after.cards.some((c) => c.cardId === cardId) && after.doneToday === before.doneToday + 1, 'A’s new flashcard is in today’s reviews; graded Easy it waits days', graded.userErrors[0]?.message ?? graded.review?.due)
}

// Rhythm (ADR-0069): A's focus day counts this week in A's zone; A plans six days, pauses from today and ends it.
{
  const RHYTHM = '{ rhythm { timeZone plannedDays target countedDays today { day counted } week { day status } pauses { id active } pauseDaysLeft } }'
  const r = (await gql(RHYTHM, {}, A.token)).rhythm
  ok(r.timeZone === 'Asia/Kolkata' && r.today.counted && r.countedDays >= 1 && r.week.find((d) => d.day === r.today.day)?.status === 'COUNTED', 'A’s Rhythm counts today, in A’s time zone', JSON.stringify({ zone: r.timeZone, today: r.today, counted: r.countedDays }))
  const OK = (op, type) => `mutation ($input: ${type}!) { ${op}(input: $input) { ok userErrors { message code } } }`
  const plan = (await gql(OK('setRhythmPlan', 'SetRhythmPlanInput'), { input: { plannedDays: [1, 2, 3, 4, 5, 6] } }, A.token)).setRhythmPlan
  const paused = (await gql(OK('pauseRhythm', 'PauseRhythmInput'), { input: { from: r.today.day, to: r.today.day, reason: 'EXAMS' } }, A.token)).pauseRhythm
  const during = (await gql(RHYTHM, {}, A.token)).rhythm
  const ended = (await gql(OK('endRhythmPause', 'RhythmPauseIdInput'), { input: { id: during.pauses[0]?.id } }, A.token)).endRhythmPause
  const after = (await gql(RHYTHM, {}, A.token)).rhythm
  // Weekly tasks (ADR-0081): A adds one with a plan; it shows with its progress this week, and goes when removed.
  const TASKS = '{ weeklyTasks { max tasks { id kind target plan progress done } } }'
  const added = (await gql('mutation ($input: AddWeeklyTaskInput!) { addWeeklyTask(input: $input) { task { id progress } userErrors { message } } }', { input: { kind: 'REVIEWS', target: 5, plan: 'After lunch' } }, A.token)).addWeeklyTask
  const listed = (await gql(TASKS, {}, A.token)).weeklyTasks.tasks.find((t) => t.id === added.task?.id)
  await gql('mutation ($input: WeeklyTaskIdInput!) { removeWeeklyTask(input: $input) { ok } }', { input: { id: added.task?.id } }, A.token)
  const gone = !(await gql(TASKS, {}, A.token)).weeklyTasks.tasks.some((t) => t.id === added.task?.id)
  ok(listed?.plan === 'After lunch' && Number.isInteger(listed.progress) && gone, 'A adds a weekly task with a plan, sees its progress, and removes it', JSON.stringify({ added, listed }))
  ok(plan.ok && paused.ok && ended.ok && during.plannedDays.length === 6 && during.pauses[0]?.active && during.pauseDaysLeft === 13 && !after.pauses.length && after.pauseDaysLeft === 14, 'A plans six days, pauses today for exams, and ends the pause: its day comes back', JSON.stringify([plan, paused, ended].map((x) => x.userErrors[0]?.message ?? 'ok')))
}

// Exams (ADR-0070): A sets an exam on a topic, answers a quiz on it in a note (one wrong), and sees the topic weak,
// the plan's sessions and Readiness from the answer.
{
  const topic = (await gql('query ($q: String!) { examTopicOptions(query: $q) { id title } }', { q: 'array' }, A.token)).examTopicOptions[0]
  const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  const made = topic ? (await gql('mutation ($input: CreateExamInput!) { createExam(input: $input) { exam { id readiness tasks { day } } userErrors { message } } }', { input: { name: `Exam ${WORD}`, date: day(30), topicIds: [topic.id] } }, A.token)).createExam : null
  await gql('mutation ($input: TrackEventsInput!) { trackEvents(input: $input) { accepted } }', { input: { timeZone: 'Asia/Kolkata', events: [{ id: newId(), type: 'QUIZ_COMPLETED', entityType: 'NOTE_CARD', entityId: newId(), topicKeys: topic ? [`topic:${topic.id}`] : [], metadata: { answered: 2, correct: 0 }, clientTs: new Date().toISOString(), platform: 'WEB' }] } }, A.token)
  let weak = []
  for (let i = 0; i < 20 && !weak.length; i++) {
    weak = (await gql('{ weakTopics { key reason accuracy } }', {}, A.token)).weakTopics
    if (!weak.length) await new Promise((r) => setTimeout(r, 500))
  }
  const exam = made?.exam ? (await gql('query ($id: UUID!) { exam(id: $id) { readiness topics { accuracy } tasks { day } } }', { id: made.exam.id }, A.token)).exam : null
  // Exams' Notes tab (ADR-0076): notes on the exam's topics, here A's own note given the topic above.
  if (topic) await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { userErrors { message } } }', { input: { noteId: id, topicIds: [topic.id] } }, A.token)
  const onTopics = async () => (await gql('query ($f: SearchFilters) { search(query: "", scopes: [NOTES], filters: $f, first: 20) { notes { note { id } } } }', { f: { topicIds: topic ? [topic.id] : [] } }, A.token)).search.notes.map((h) => h.note.id)
  ok(!!topic && (await eventually(async () => (await onTopics()).includes(id), 15_000)), 'the exam’s Notes find A’s note on its topic')
  ok(!!topic && !!made?.exam && made.exam.tasks.length === 1 && weak.some((w) => w.key === `topic:${topic.id}` && w.reason === 'LOW_ACCURACY') && exam?.topics[0]?.accuracy === 0, 'A sets an exam a month away on a topic; a wrong quiz answer makes it weak and counts in Readiness', JSON.stringify({ topic: topic?.title, error: made?.userErrors[0]?.message, weak, exam }))
}

// Recommendations (ADR-0071): A's weak topic from the quiz above is recommended, with why.
{
  const recs = (await gql('{ recommendations(limit: 20) { kind reason topicKey } }', {}, A.token)).recommendations
  ok(recs.some((r) => r.kind === 'REVISE_TOPIC' && r.reason === 'Under 60% right in your last quizzes'), 'A is recommended the topic A got wrong, saying why', JSON.stringify(recs.slice(0, 3)))
}

// Focus and buddies (ADR-0072), on the local environment where accounts can be verified by SQL: E follows A and asks A
// to be buddies; A accepts; E focuses with a Meet link and A sees E studying now; ending counts the time.
if (opt('--vm')) {
  const D = await signUp('e')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id = '${D.id}'`)
  const aHandle = (await gql('{ viewer { handle } }', {}, A.token)).viewer.handle
  await gql('mutation ($input: PersonInput!) { followUser(input: $input) { userErrors { message } } }', { input: { userId: A.id } }, D.token)
  const OK = (op, type) => `mutation ($input: ${type}!) { ${op}(input: $input) { ok userErrors { message } } }`
  const asked = (await gql(OK('inviteRhythmBuddy', 'InviteRhythmBuddyInput'), { input: { handle: aHandle } }, D.token)).inviteRhythmBuddy
  const invite = (await gql('{ rhythmBuddies { invites { id } } }', {}, A.token)).rhythmBuddies.invites[0]
  const accepted = invite ? (await gql(OK('answerRhythmBuddy', 'AnswerRhythmBuddyInput'), { input: { id: invite.id, accept: true } }, A.token)).answerRhythmBuddy : { ok: false, userErrors: [{ message: 'no invite' }] }
  const started = (await gql('mutation ($input: StartFocusSessionInput!) { startFocusSession(input: $input) { session { id } userErrors { message } } }', { input: { minutes: 25, meetUrl: 'https://meet.google.com/abc-defg-hij' } }, D.token)).startFocusSession
  const seen = (await gql('{ rhythmBuddies { buddies { studyingNow meetUrl user { id } } } }', {}, A.token)).rhythmBuddies.buddies
  ok(asked.ok && accepted.ok && seen.some((b) => b.user.id === D.id && b.studyingNow && b.meetUrl === 'https://meet.google.com/abc-defg-hij'), 'E asks A to be buddies, A accepts, and A sees E studying now with the Meet link', JSON.stringify([asked, accepted, started.userErrors, seen]))
  const ended = (await gql('mutation ($input: FocusSessionIdInput!) { endFocusSession(input: $input) { session { endedAt focusedSeconds } userErrors { message } } }', { input: { id: started.session?.id } }, D.token)).endFocusSession
  const after = (await gql('{ rhythmBuddies { buddies { studyingNow } } }', {}, A.token)).rhythmBuddies.buddies
  ok(!!ended.session?.endedAt && after.every((b) => !b.studyingNow), 'E ends the session; A no longer sees E studying', JSON.stringify(ended))
}

// Becoming a teacher (ADR-0073), on the local environment where an admin can be made by SQL: F applies to teach and
// prepares a class at once, but cannot invite; a platform admin approves, and F's class takes students.
if (opt('--vm')) {
  const F = await signUp('f')
  const reviewer = await signUp('teach-admin')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL', \\"globalRole\\" = 'PLATFORM_ADMIN' WHERE id = '${reviewer.id}'`)
  const applied = (await gql('mutation ($input: ApplyToTeachInput!) { applyToTeach(input: $input) { request { id status } userErrors { message } } }', { input: { institution: 'Govt. Junior College', subjects: 'Physics' } }, F.token)).applyToTeach
  const klass = (await gql('mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } userErrors { message } } }', { input: { name: `Physics ${WORD}` } }, F.token)).createClassroom
  const early = await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId: klass.classroom?.id, person: B.handle } }, F.token).catch((e) => e.message)
  ok(applied.request?.status === 'PENDING' && !!klass.classroom?.id && /verified as a teacher/.test(String(early)), 'F applies to teach and prepares a class at once, but cannot invite yet', JSON.stringify([applied.userErrors, klass.userErrors, String(early)]))
  const decided = (await gql('mutation ($input: ReviewVerificationRequestInput!) { reviewVerificationRequest(input: $input) { request { status } userErrors { message } } }', { input: { requestId: applied.request?.id, approve: true } }, reviewer.token)).reviewVerificationRequest
  const viewer = (await gql('{ viewer { teacherStatus globalRole verified } }', {}, F.token)).viewer
  const invited = (await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } userErrors { message } } }', { input: { classroomId: klass.classroom?.id, person: B.handle } }, F.token)).inviteToClassroom
  ok(decided.request?.status === 'APPROVED' && viewer.teacherStatus === 'VERIFIED' && viewer.globalRole === 'TEACHER' && viewer.verified && !invited.userErrors.length, 'a platform admin approves: F is a verified teacher, and F’s class takes students', JSON.stringify([decided.userErrors, viewer, invited.userErrors]))
}

// Resources (ADR-0074), with the real Open Library: G looks a book up by its ISBN and sends it with its cover; it waits
// unseen by anyone else; a platform admin approves it from the queue; a guest reads it, and its cover is in storage.
// G deletes it at the end, so the next run can send the same book again.
if (opt('--vm')) {
  const G = await signUp('g')
  const moderator = await signUp('res-admin')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id = '${G.id}'`)
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL', \\"globalRole\\" = 'PLATFORM_ADMIN' WHERE id = '${moderator.id}'`)
  const preview = (await gql('query ($input: ResourcePreviewInput!) { resourcePreview(input: $input) { url title author isbn type imageUrl found } }', { input: { isbn: '0-13-235088-2' } }, G.token)).resourcePreview
  ok(preview.found && /Clean Code/.test(preview.title ?? '') && /Martin/.test(preview.author ?? '') && preview.isbn === '9780132350884' && preview.type === 'BOOK', 'G looks a book up by its ISBN on Open Library, its authors from the work', JSON.stringify(preview))
  const topic = (await gql('query ($q: String!) { examTopicOptions(query: $q) { id } }', { q: 'array' }, G.token)).examTopicOptions[0]
  const sent = (await gql('mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { resource { id status coverUrl } userErrors { message } } }', { input: { type: 'BOOK', title: preview.title, url: `${preview.url}?run=${WORD}`, isbn: `${preview.isbn}`, author: preview.author, topicIds: [topic?.id], imageUrl: preview.imageUrl } }, G.token)).submitResource
  const id = sent.resource?.id
  const unseen = id ? (await gql('query ($id: UUID!) { resource(id: $id) { id } }', { id })).resource : 'no resource'
  ok(sent.resource?.status === 'PENDING' && unseen === null, 'G sends it: it waits for moderators, and a guest cannot see it', JSON.stringify([sent.userErrors, unseen]))
  // The queue holds what earlier runs left open too: look through it page by page.
  let queued = false
  for (let after = null, pages = 0; !queued && pages < 20; pages++) {
    const q = (await gql('query ($after: String) { moderationQueue(first: 50, after: $after) { edges { node { resource { id } } } pageInfo { hasNextPage endCursor } } }', { after }, moderator.token)).moderationQueue
    queued = q.edges.some((e) => e.node.resource?.id === id)
    if (!q.pageInfo.hasNextPage) break
    after = q.pageInfo.endCursor
  }
  const decided = (await gql('mutation ($input: ModerateContentInput!) { moderateContent(input: $input) { ok userErrors { message } } }', { input: { entityType: 'RESOURCE', entityId: id, action: 'APPROVE' } }, moderator.token)).moderateContent
  const seen = (await gql('query ($id: UUID!) { resource(id: $id) { status title coverUrl submittedBy { id } } }', { id })).resource
  const cover = seen?.coverUrl ? await fetch(seen.coverUrl) : null
  ok(queued && decided.ok && seen?.status === 'APPROVED' && cover?.ok && /^image\//.test(cover.headers.get('content-type') ?? ''), 'a platform admin approves it from the queue; a guest reads it, with its cover from storage', JSON.stringify([queued, decided, seen, cover?.status]))
  // ADR-0075: search (the environment's Typesense) finds it once indexed; a save and a comment.
  let found = []
  for (let i = 0; i < 20 && !found.some((r) => r.id === id); i++) {
    found = (await gql('{ search(query: "clean code", scopes: [RESOURCES], first: 20) { resources { id } } }')).search.resources
    if (!found.some((r) => r.id === id)) await new Promise((r) => setTimeout(r, 1000))
  }
  const saved = (await gql('mutation ($input: ResourceIdInput!) { saveResource(input: $input) { resource { saveCount viewerSaved } userErrors { message } } }', { input: { id } }, moderator.token)).saveResource
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Chapter 3 on functions, run ${WORD}` }] }] }
  const commented = (await gql('mutation ($input: AddCommentInput!) { addComment(input: $input) { comment { id } userErrors { message } } }', { input: { target: { type: 'RESOURCE', id }, body } }, moderator.token)).addComment
  const talk = (await gql('query ($target: CommentTargetInput!) { discussion(target: $target) { commentCount } }', { target: { type: 'RESOURCE', id } }, G.token)).discussion
  ok(found.some((r) => r.id === id) && saved.resource?.saveCount === 1 && saved.resource.viewerSaved && !!commented.comment && talk?.commentCount === 1, 'search finds the approved book; it is saved once and discussed', JSON.stringify([found.length, saved, commented.userErrors, talk]))
  const removed = (await gql('mutation ($input: ResourceIdInput!) { deleteResource(input: $input) { ok } }', { input: { id } }, G.token)).deleteResource
  const gone = (await gql('query ($id: UUID!) { resource(id: $id) { id } }', { id })).resource
  ok(removed.ok && gone === null, 'G deletes it, and it is gone for everyone', JSON.stringify([removed, gone]))
}

// Account deletion (ADR-0088): H asks with the password and DELETE. The 14 days are wound back in the database and the
// nightly job is run now with the worker's CLI: H's private note goes, the public one stays by "Deleted user", and H
// cannot sign in again.
if (opt('--vm')) {
  const H = await signUp('h')
  sql(`UPDATE users.\\"User\\" SET \\"verifiedAt\\" = now(), \\"verificationMethod\\" = 'INSTITUTIONAL_EMAIL' WHERE id = '${H.id}'`)
  const write = async (title) => (await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: `${title} ${WORD}`, cards: [{ id: newId(), type: 'text', position: 'a0', content: text(`${title}, in H's words.`) }] } }, H.token)).createNote.note.id
  const diary = await write('Diary')
  const shared = await write('Graphs explained')
  await gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: shared } }, H.token)
  await gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId: shared, visibility: 'PUBLIC' } }, H.token)
  const asked = (await gql('mutation ($input: RequestAccountDeletionInput!) { requestAccountDeletion(input: $input) { deletionScheduledFor userErrors { message } } }', { input: { password: `lifecycle passphrase ${stamp}`, confirm: 'DELETE' } }, H.token)).requestAccountDeletion
  const days = asked.deletionScheduledFor ? Math.round((new Date(asked.deletionScheduledFor).getTime() - Date.now()) / 86_400_000) : null
  ok(days === 14, 'H asks to delete the account with the password and DELETE: it goes in 14 days', JSON.stringify(asked))
  sql(`UPDATE users.\\"User\\" SET \\"deletionRequestedAt\\" = now() - interval '15 days' WHERE id = '${H.id}'`)
  execFileSync(opt('--vm'), ['ssh', 'docker exec lvn-local-worker node apps/worker/dist/cli.js queue:run users.maintenance delete-accounts'], { stdio: 'pipe' })
  const value = (statement) => execFileSync(opt('--vm'), ['ssh', `docker exec lvn-local-postgres psql -U lvn -d lvn -tAc "${statement}"`], { stdio: 'pipe' }).toString().trim()
  const erased = await eventually(async () => value(`SELECT count(*) FROM notes.\\"Note\\" WHERE id = '${diary}'`) === '0', 60_000)
  const kept = (await gql('query ($id: UUID!) { note(id: $id) { title owner { displayName handle } } }', { id: shared })).note
  const again = (await gql('mutation ($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { message } } }', { input: { email: H.email, password: `lifecycle passphrase ${stamp}` } }).catch((e) => ({ signIn: { session: null, userErrors: [{ message: e.message }] } }))).signIn
  ok(erased && kept?.owner.displayName === 'Deleted user' && /^deleted-/.test(kept.owner.handle) && !again.session, 'after 14 days the job deletes H\'s private note, keeps the public one by "Deleted user", and H cannot sign in', JSON.stringify([erased, kept, again.userErrors]))
}

console.log(`1..${n}`)
if (failed) {
  console.log(`# ${failed} of ${n} checks failed`)
  process.exit(1)
}
console.log(`# all ${n} checks passed`)

/** A PNG of one colour, made here so the check needs nothing installed. */
function png(width, height) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // 8 bits per channel
  header[9] = 2 // RGB
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) row.set([0x4f, 0x46, 0xe5], 1 + x * 3)
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))])
}

/** The width of a WebP picture from its header (lossy, lossless or extended), or null if it is not one. */
function webpWidth(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null
  const kind = b.toString('latin1', 12, 16)
  if (kind === 'VP8 ') return b.readUInt16LE(26) & 0x3fff
  if (kind === 'VP8L') return 1 + (((b[22] & 0x3f) << 8) | b[21])
  if (kind === 'VP8X') return 1 + b.readUIntLE(24, 3)
  return null
}

/**
 * A graphql-ws client (the graphql-transport-ws protocol) on Node's WebSocket, subscribed to `live` (ADR-0042). The URL
 * comes from LVN_LIVE_URL, else from the entrance's (http → ws, /graphql/live).
 */
async function openLive(token) {
  const url = process.env.LVN_LIVE_URL ?? `${base.replace(/^http/, 'ws')}/graphql/live`
  const socket = new WebSocket(url, 'graphql-transport-ws')
  const events = []
  const waiters = []
  socket.addEventListener('message', (m) => {
    const msg = JSON.parse(String(m.data))
    if (msg.type === 'connection_ack') socket.send(JSON.stringify({ id: '1', type: 'subscribe', payload: { query: 'subscription { live { kind id at } }' } }))
    if (msg.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }))
    if (msg.type === 'next') {
      events.push(msg.payload.data.live)
      waiters.splice(0).forEach((w) => w())
    }
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(socket.send(JSON.stringify({ type: 'connection_init', payload: { authorization: `Bearer ${token}` } }))))
    socket.addEventListener('error', () => reject(new Error(`cannot open ${url}`)))
  })
  return {
    next: (ms) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no live event')), ms)
        const check = () => (events.length ? (clearTimeout(timer), resolve(events[0])) : waiters.push(check))
        check()
      }),
    close: () => socket.close(),
  }
}
