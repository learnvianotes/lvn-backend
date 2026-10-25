import { open, readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

/** PDF names that mean active content. Each must end on a delimiter so `/JSX` is not `/JS` and `/EmbeddedFiles` is not `/EmbeddedFile`. */
const NAMES: { token: string; reason: string }[] = [
  { token: '/JavaScript', reason: 'javascript' },
  { token: '/JS', reason: 'javascript' },
  { token: '/Launch', reason: 'launch' },
  { token: '/EmbeddedFile', reason: 'embedded-file' },
  { token: '/RichMedia', reason: 'rich-media' },
  { token: '/XFA', reason: 'xfa' },
]

/** PDF delimiter bytes: whitespace, ()<>[]{}/% */
const DELIMITERS = new Set([0, 9, 10, 12, 13, 32, 40, 41, 60, 62, 91, 93, 123, 125, 47, 37])

export interface PdfInspection {
  pageCount: number | null
  reasons: string[]
}

/** Null when the file is not a PDF. A PDF over the size cap is unsafe and is not parsed. */
export async function inspectIfPdf(file: string, mime: string, size: number, maxBytes: number): Promise<PdfInspection | null> {
  if (mime !== 'application/pdf' && !(await startsWithPdf(file))) return null
  if (size > maxBytes) return { pageCount: null, reasons: ['too-large'] }
  const buf = await readFile(file)
  const reasons = pdfRisks(buf)
  let pageCount: number | null = null
  try {
    pageCount = (await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })).getPageCount()
  } catch {
    pageCount = null
  }
  return { pageCount, reasons }
}

export function pdfRisks(buf: Buffer): string[] {
  const reasons: string[] = []
  for (const name of NAMES) {
    if (reasons.includes(name.reason)) continue
    if (hasName(buf, name.token)) reasons.push(name.reason)
  }
  return reasons
}

async function startsWithPdf(file: string): Promise<boolean> {
  const handle = await open(file, 'r')
  try {
    const buf = Buffer.alloc(5)
    const { bytesRead } = await handle.read(buf, 0, 5, 0)
    return bytesRead >= 5 && buf.toString('latin1') === '%PDF-'
  } finally {
    await handle.close()
  }
}

function hasName(buf: Buffer, token: string): boolean {
  const needle = Buffer.from(token)
  let from = 0
  while (from < buf.length) {
    const at = buf.indexOf(needle, from)
    if (at < 0) return false
    const next = buf[at + needle.length]
    if (next === undefined || DELIMITERS.has(next)) return true
    from = at + 1
  }
  return false
}
