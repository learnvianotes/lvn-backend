// Load test (§17 performance, Phase 9 P9c): learners using the app at once against a deployed environment.
//   docker run --rm -i --network host -e BASE_URL=http://100.70.234.41:8080 grafana/k6:0.54.0 run - < scripts/load/k6-learners.js
// Options: VUS (default 500), HOLD (default 5m), USERS (accounts made in setup, default 100).
// Thresholds are the SLOs (§16.4): API p95 < 300 ms, errors < 0.1 %, public note TTFB p95 < 500 ms. A breach fails the run.
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://100.70.234.41:8080'
const VUS = Number(__ENV.VUS || 500)
const USERS = Number(__ENV.USERS || 100)
const HOLD = __ENV.HOLD || '5m'
const publicTtfb = new Trend('public_note_ttfb', true)

export const options = {
  setupTimeout: '10m',
  scenarios: {
    learners: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration{kind:api}': ['p(95)<300'],
    'http_req_failed{kind:api}': ['rate<0.001'],
    public_note_ttfb: ['p(95)<500'],
    checks: ['rate>0.999'],
  },
}

const gql = (token, op, query, variables = {}) => {
  const res = http.post(`${BASE}/graphql`, JSON.stringify({ operationName: op, query, variables }), {
    headers: { 'content-type': 'application/json', 'x-lvn-client': 'mobile', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    tags: { kind: 'api', op },
  })
  check(res, { [`${op} answered`]: (r) => r.status === 200 && !(r.json('errors') || []).length })
  return res
}

const text = (s) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] } })
const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))
const TOPICS = ['Dijkstra shortest paths', 'Binary heaps', 'Process scheduling', 'Deadlocks', 'TCP handshake', 'Normal forms', 'Dynamic programming', 'Paging and TLBs']

// Accounts, each with a few notes, one of them public: what a learner already has.
export function setup() {
  const terms = gql(null, 'Terms', 'query Terms { termsVersion }').json('data.termsVersion')
  const run = Date.now()
  const learners = []
  for (let i = 0; i < USERS; i++) {
    const res = gql(null, 'SignUp', 'mutation SignUp($input: SignUpInput!) { signUp(input: $input) { session { accessToken } userErrors { message } } }', {
      input: { email: `load-${run}-${i}@example.com`, password: `load test passphrase ${run} ${i}`, displayName: `Load Learner ${i}`, dateOfBirth: '2002-04-11', acceptedTermsVersion: terms },
    })
    const token = res.json('data.signUp.session.accessToken')
    if (!token) continue
    const notes = []
    for (const [n, topic] of TOPICS.slice(0, 3).entries()) {
      const id = gql(token, 'CreateNote', 'mutation CreateNote($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', {
        input: { title: `${topic} (${i})`, cards: [{ id: uuid(), type: 'text', position: 'a0', content: text(`${topic}: what I learned, in my own words. `.repeat(8)) }] },
      }).json('data.createNote.note.id')
      notes.push(id)
      if (n === 0) {
        gql(token, 'Publish', 'mutation Publish($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId: id } })
        gql(token, 'Visibility', 'mutation Visibility($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id slug } } }', { input: { noteId: id, visibility: 'PUBLIC' } })
      }
    }
    learners.push({ token, notes })
  }
  const pub = gql(learners[0].token, 'PublicNotes', 'query PublicNotes { publicNotes(first: 20) { edges { node { id slug } } } }').json('data.publicNotes.edges') || []
  return { learners, publicPaths: pub.map((e) => `/n/${e.node.slug || 'note'}-${e.node.id}`) }
}

const HOME = `query Home {
  viewer { id displayName }
  dailyLine { title line fromAi pending }
  rhythm { countedDays target met today { counted learningSeconds reviews } }
  recommendations(limit: 8) { kind reason noteTitle topicTitle }
  exams { id name daysLeft }
  unreadNotificationCount
}`
const MY_NOTES = 'query MyNotes { myNotes(first: 30) { edges { node { id title updatedAt } } } }'
const NOTE = 'query Note($id: UUID!) { note(id: $id) { id title visibility cards(first: 100) { edges { node { id type content } } } } }'
const SEARCH = 'query Search($q: String!) { search(query: $q, first: 20) { notes { snippet note { id title } } } }'
const FOR_YOU = 'query ForYou { forYouFeed(first: 20) { edges { node { __typename } } } }'
const WRITE = 'mutation Write($input: UpdateNoteDraftInput!) { updateNoteDraft(input: $input) { results { status } } }'

export default function (data) {
  const me = data.learners[(__VU - 1) % data.learners.length]
  if (!me) return
  group('home', () => gql(me.token, 'Home', HOME))
  sleep(1 + Math.random() * 2)
  group('notes', () => {
    gql(me.token, 'MyNotes', MY_NOTES)
    const id = me.notes[Math.floor(Math.random() * me.notes.length)]
    gql(me.token, 'Note', NOTE, { id })
    // One learner in five writes a card while reading.
    if (Math.random() < 0.2) gql(me.token, 'Write', WRITE, { input: { noteId: id, ops: [{ kind: 'UPSERT', id: uuid(), type: 'text', position: `b${Date.now()}1`, content: text('A new thought while revising.') }] } })
  })
  sleep(1 + Math.random() * 3)
  group('search', () => gql(me.token, 'Search', SEARCH, { q: TOPICS[Math.floor(Math.random() * TOPICS.length)].split(' ')[0] }))
  sleep(1 + Math.random() * 2)
  group('community', () => gql(me.token, 'ForYou', FOR_YOU))
  sleep(1 + Math.random() * 2)
  // Visitors from search engines: a public note page, server-rendered by the web.
  if (data.publicPaths.length) {
    const res = http.get(`${BASE}${data.publicPaths[Math.floor(Math.random() * data.publicPaths.length)]}`, { tags: { kind: 'page' } })
    check(res, { 'public note page': (r) => r.status === 200 })
    publicTtfb.add(res.timings.waiting)
  }
  sleep(2 + Math.random() * 3)
}
