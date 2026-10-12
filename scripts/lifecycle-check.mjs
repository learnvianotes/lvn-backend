#!/usr/bin/env node
/**
 * The note lifecycle on a deployed environment (spec §18, Phase 2 exit), through its single entrance, as TAP like
 * smoke.mjs: two people, A and B. A writes a note, publishes it, shares it with B (every live socket of B's hears of it,
 * on either API instance, ADR-0042), makes it public; anonymous visitors
 * read its page, the sitemap lists it and search finds it; B copies it; A publishes a second version and the page
 * follows; A makes it private again and it leaves the page, the sitemap and search; a device of A's syncs it and sends
 * an edit made offline; A moves it to the trash and back; a picture on it gets its sizes and an infected file is
 * quarantined (ADR-0041, with the environment's ClamAV). Publishing needs a verified account: on the local environment
 * A is verified through its database (--vm), elsewhere pass a verified account's token (--token-a).
 *
 *   node scripts/lifecycle-check.mjs <public_url> --vm infra/local-vm/vm.sh
 *   node scripts/lifecycle-check.mjs <public_url> --token-a <access token of a verified account>
 */
import { execFileSync } from 'node:child_process'
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
