import type { TestApp } from './app'

/** Small byte samples with the right magic numbers. */
export const SAMPLES = {
  png: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  pdf: new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'),
  html: new TextEncoder().encode('<html><script>alert(1)</script></html>'),
}

const INTENT = `mutation ($input: CreateUploadIntentInput!) {
  createUploadIntent(input: $input) { intent { fileId uploadUrl uploadHeaders { name value } expiresAt } userErrors { field message code } }
}`
const COMPLETE = 'mutation ($id: UUID!) { completeUpload(fileId: $id) { ok userErrors { message code } } }'

export interface Intent {
  fileId: string
  uploadUrl: string
  uploadHeaders: { name: string; value: string }[]
}

export async function createIntent(t: TestApp, token: string, input: { fileName: string; mimeType: string; sizeBytes: number; purpose: string; parentId?: string }) {
  const res = await t.gql<{ createUploadIntent: { intent: Intent | null; userErrors: { field: string[] | null; message: string; code: string }[] } }>(INTENT, { input }, token)
  if (res.errors) return { intent: null, userErrors: res.errors.map((e) => ({ field: null, message: e.message, code: e.extensions.code })) }
  return res.data!.createUploadIntent
}

/** PUT the bytes to the pre-signed URL with exactly the headers the API asked for, as clients do. */
export async function put(intent: Intent, body: Uint8Array): Promise<number> {
  const headers = Object.fromEntries(intent.uploadHeaders.map((h) => [h.name, h.value]))
  return (await fetch(intent.uploadUrl, { method: 'PUT', headers, body })).status
}

export async function complete(t: TestApp, token: string, fileId: string) {
  return (await t.gql<{ completeUpload: { ok: boolean; userErrors: { message: string; code: string }[] } }>(COMPLETE, { id: fileId }, token)).data!.completeUpload
}

/** The whole upload flow (§8.1); returns the READY file's id. */
export async function upload(t: TestApp, token: string, purpose: string, mimeType: string, bytes: Uint8Array, fileName = 'file', parentId?: string): Promise<string> {
  const { intent, userErrors } = await createIntent(t, token, { fileName, mimeType, sizeBytes: bytes.length, purpose, ...(parentId ? { parentId } : {}) })
  if (!intent) throw new Error(`upload intent refused: ${JSON.stringify(userErrors)}`)
  expect(await put(intent, bytes)).toBe(200)
  expect(await complete(t, token, intent.fileId)).toEqual({ ok: true, userErrors: [] })
  return intent.fileId
}
