import type { TestApp } from './app'

/** Small byte samples with the right magic numbers. */
export const SAMPLES = {
  png: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
  pdf: new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n'),
  html: new TextEncoder().encode('<html><script>alert(1)</script></html>'),
}

/** A PDF whose pages carry these lines as real text (Helvetica), with a correct cross-reference table. */
export function textPdf(pages: string[][]): Uint8Array {
  const objects: string[] = []
  const font = 3 + pages.length * 2
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`
  pages.forEach((lines, i) => {
    const stream = `BT /F1 12 Tf 72 720 Td ${lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj 0 -16 Td`).join(' ')} ET`
    objects[3 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`
    objects[4 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  objects[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`
  }
  const xref = out.length
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
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
