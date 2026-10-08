#!/usr/bin/env node
/**
 * Smoke test of a deployed environment through its public entrance, as a new user would go (Phase 1 exit criteria,
 * §18): readiness, email sign-up (as the app) and sign-in (as the web), the session refresh, an avatar upload and an
 * identity document upload through pre-signed PUTs, a note written, saved and trashed (Phase 2), and — with
 * --mailpit — the email that sign-up sends.
 *
 *   node scripts/smoke.mjs <public_url> [--mailpit <mailpit_url>]
 *   pnpm smoke http://127.0.0.1:8080 --mailpit http://127.0.0.1:8025      (the local environment, ADR-0036)
 *
 * Each run creates one account, smoke-<time>@example.com, and leaves it in place. Exits non-zero on the first failure.
 */
const [base, ...rest] = process.argv.slice(2)
if (!base) {
  console.error('usage: node scripts/smoke.mjs <public_url> [--mailpit <mailpit_url>]')
  process.exit(2)
}
const mailpit = rest[0] === '--mailpit' ? rest[1] : undefined
const url = base.replace(/\/$/, '')
const graphql = `${url}/graphql`

// The same samples as the API's upload tests (apps/api/test/support/flows.ts): the right magic numbers, nothing else.
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')

const SESSION = 'session { accessToken accessTokenExpiresAt refreshToken user { id email registrationComplete } } userErrors { field message code }'

let step = 0
async function check(name, fn) {
  step += 1
  const started = Date.now()
  try {
    const detail = await fn()
    console.log(`ok ${step} - ${name}${detail ? ` (${detail})` : ''} [${Date.now() - started} ms]`)
  } catch (e) {
    console.log(`not ok ${step} - ${name}\n  ${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function gql(query, variables = {}, { token, mobile = false } = {}) {
  const res = await fetch(graphql, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(mobile ? { 'x-lvn-client': 'mobile' } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors?.length) throw new Error(`${res.status}: ${body.errors.map((e) => `${e.extensions?.code}: ${e.message}`).join('; ')}`)
  return { data: body.data, res }
}

function payload(result, field) {
  const p = result.data[field]
  assert(p.userErrors.length === 0, `${field}: ${JSON.stringify(p.userErrors)}`)
  return p
}

async function uploadFile(token, purpose, mimeType, fileName, bytes) {
  const intent = payload(
    await gql('mutation ($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { fileId uploadUrl uploadHeaders { name value } } userErrors { field message code } } }', { input: { fileName, mimeType, sizeBytes: bytes.length, purpose } }, { token }),
    'createUploadIntent',
  ).intent
  const put = await fetch(intent.uploadUrl, { method: 'PUT', headers: Object.fromEntries(intent.uploadHeaders.map((h) => [h.name, h.value])), body: bytes })
  assert(put.ok, `PUT ${new URL(intent.uploadUrl).origin}: HTTP ${put.status} ${await put.text()}`)
  payload(await gql('mutation ($id: UUID!) { completeUpload(fileId: $id) { ok userErrors { field message code } } }', { id: intent.fileId }, { token }), 'completeUpload')
  return `${new URL(intent.uploadUrl).origin}, file ${intent.fileId}`
}

const email = `smoke-${Date.now()}@example.com`
const password = `smoke ${crypto.randomUUID()}`
let mobileSession
let webToken

console.log(`# smoke test of ${url} as ${email}`)

await check('the API is ready (database, Redis, schema version)', async () => {
  const res = await fetch(`${url}/health/ready`)
  const text = await res.text()
  assert(res.ok, `HTTP ${res.status}: ${text}`)
  return text
})

await check('the web answers on the same origin', async () => {
  const res = await fetch(url)
  assert(res.ok, `HTTP ${res.status}`)
  assert((await res.text()).includes('LearnViaNotes'), 'the page does not mention LearnViaNotes')
})

let terms
await check('sign-in options and the terms version', async () => {
  const { data } = await gql('{ signInOptions { emailPassword google github linkedin } termsVersion }')
  assert(data.signInOptions.emailPassword, 'email and password sign-in is off')
  terms = data.termsVersion
  return Object.entries(data.signInOptions).filter(([, on]) => on).map(([k]) => k).join(', ')
})

await check('signs up with email, as the app (refresh token in the body)', async () => {
  const p = payload(
    await gql(`mutation ($input: SignUpInput!) { signUp(input: $input) { ${SESSION} } }`, { input: { email, password, displayName: 'Smoke Test', dateOfBirth: '2000-01-01', acceptedTermsVersion: terms } }, { mobile: true }),
    'signUp',
  )
  assert(p.session?.refreshToken, 'no refresh token for the app')
  mobileSession = p.session
  return `user ${p.session.user.id}`
})

await check('the access token works', async () => {
  const { data } = await gql('{ viewer { email registrationComplete } }', {}, { token: mobileSession.accessToken })
  assert(data.viewer?.email === email, `viewer is ${JSON.stringify(data.viewer)}`)
})

await check('refreshes the app session (rotating refresh token)', async () => {
  const p = payload(await gql(`mutation ($input: RefreshSessionInput!) { refreshSession(input: $input) { ${SESSION} } }`, { input: { refreshToken: mobileSession.refreshToken } }, { mobile: true }), 'refreshSession')
  assert(p.session.refreshToken && p.session.refreshToken !== mobileSession.refreshToken, 'the refresh token did not rotate')
  mobileSession = p.session
})

await check('signs in with email, as the web (refresh token as an HttpOnly cookie)', async () => {
  const result = await gql(`mutation ($input: SignInInput!) { signIn(input: $input) { ${SESSION} } }`, { input: { email, password } })
  const p = payload(result, 'signIn')
  const cookie = result.res.headers.get('set-cookie') ?? ''
  assert(/httponly/i.test(cookie), `no HttpOnly refresh cookie: ${cookie || 'none'}`)
  assert(p.session.refreshToken === null, 'the web must not receive the refresh token in the body')
  webToken = p.session.accessToken
  return /;\s*secure/i.test(cookie) ? 'Secure cookie' : 'cookie without Secure (http origin)'
})

await check('a wrong password is refused', async () => {
  const { data } = await gql(`mutation ($input: SignInInput!) { signIn(input: $input) { ${SESSION} } }`, { input: { email, password: `${password}!` } })
  assert(data.signIn.session === null && data.signIn.userErrors.length === 1, JSON.stringify(data.signIn))
})

await check('uploads an avatar: pre-signed PUT, then the API checks the bytes (files bucket)', () => uploadFile(webToken, 'AVATAR', 'image/png', 'me.png', PNG))

await check('browsers on the web origin may upload to storage (CORS preflight of a pre-signed PUT)', async () => {
  const intent = payload(
    await gql('mutation ($input: CreateUploadIntentInput!) { createUploadIntent(input: $input) { intent { uploadUrl uploadHeaders { name value } } userErrors { field message code } } }', { input: { fileName: 'cors.png', mimeType: 'image/png', sizeBytes: PNG.length, purpose: 'AVATAR' } }, { token: webToken }),
    'createUploadIntent',
  ).intent
  // What a browser asks before the PUT: every header it will send except Content-Length, which browsers set themselves.
  const headers = intent.uploadHeaders.map((h) => h.name.toLowerCase()).filter((h) => h !== 'content-length')
  const res = await fetch(intent.uploadUrl, { method: 'OPTIONS', headers: { Origin: url, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': headers.join(',') } })
  assert(res.ok && res.headers.get('access-control-allow-origin') === url, `preflight from ${url}: HTTP ${res.status}, allow-origin ${res.headers.get('access-control-allow-origin')}`)
  return `${headers.length} headers allowed`
})

await check('uploads an identity document (restricted bucket)', () => uploadFile(webToken, 'VERIFICATION_DOCUMENT', 'application/pdf', 'id-card.pdf', PDF))

await check('writes a note, autosaves a change and reads it back (Phase 2)', async () => {
  const card = crypto.randomUUID()
  const text = (t) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] } })
  const created = payload(
    await gql('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id draftRevision } userErrors { field message code } } }', { input: { title: 'Smoke note', cards: [{ id: card, type: 'text', position: 'a0', content: text('first') }] } }, { token: webToken }),
    'createNote',
  )
  const noteId = created.note.id
  const saved = payload(
    await gql('mutation ($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { note { draftRevision } results { status } userErrors { field message code } } }', { input: { noteId, ops: [{ kind: 'UPSERT', id: card, type: 'text', position: 'a0', content: text('second'), baseRevision: 1 }] } }, { token: webToken }),
    'updateNoteDraft',
  )
  assert(saved.results[0].status === 'APPLIED', `save: ${JSON.stringify(saved.results)}`)
  const { data } = await gql('query ($id: UUID!) { note(id: $id) { title cards { edges { node { content } } } } }', { id: noteId }, { token: webToken })
  const words = data.note.cards.edges[0].node.content.doc.content[0].content[0].text
  assert(words === 'second', `read back "${words}"`)
  payload(await gql('mutation ($id: UUID!) { deleteNote(input: { noteId: $id }) { note { id } userErrors { field message code } } }', { id: noteId }, { token: webToken }), 'deleteNote')
  return `note ${noteId}`
})

if (mailpit) {
  await check('sign-up sent an email', async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await fetch(`${mailpit.replace(/\/$/, '')}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
      const body = await res.json()
      if (body.messages_count > 0) return body.messages.map((m) => m.Subject).join('; ')
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`no email to ${email} in Mailpit`)
  })
}

console.log(`# all ${step} checks passed`)
