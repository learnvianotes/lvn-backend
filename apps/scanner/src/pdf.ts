import { open } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'

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

/** How much of the previous read is kept so a name or `/Count` can span two reads. */
const OVERLAP = 512
const READ_SIZE = 64 * 1024
/** A compressed stream larger than this is not inflated. One stream is inflated at a time, then dropped. */
const MAX_DEFLATED = 1024 * 1024
const MAX_INFLATED = 4 * 1024 * 1024

/**
 * Null when the file is not a PDF. A PDF over the size cap is unsafe and is not read.
 * Names and the page-tree `/Count` are scanned from the file in chunks. The bytes are not
 * loaded into one buffer: this host has about 355 MB free beside clamd.
 */
export async function inspectIfPdf(file: string, mime: string, size: number, maxBytes: number): Promise<PdfInspection | null> {
  if (mime !== 'application/pdf' && !(await startsWithPdf(file))) return null
  if (size > maxBytes) return { pageCount: null, reasons: ['too-large'] }
  return scanPdfFile(file)
}

export function pdfRisks(buf: Buffer): string[] {
  const reasons: string[] = []
  for (const name of NAMES) {
    if (reasons.includes(name.reason)) continue
    if (hasName(buf, name.token)) reasons.push(name.reason)
  }
  return reasons
}

async function scanPdfFile(file: string): Promise<PdfInspection> {
  const handle = await open(file, 'r')
  try {
    const size = (await handle.stat()).size
    const reasons = new Set<string>()
    const pageCount = { value: null as number | null }
    let carry = Buffer.alloc(0)
    const chunk = Buffer.alloc(READ_SIZE)
    let offset = 0
    while (offset < size) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset)
      if (bytesRead <= 0) break
      const window = Buffer.concat([carry, chunk.subarray(0, bytesRead)])
      for (const name of NAMES) {
        if (reasons.has(name.reason)) continue
        if (hasName(window, name.token)) reasons.add(name.reason)
      }
      const count = pagesCount(window)
      if (count != null && (pageCount.value == null || count > pageCount.value)) pageCount.value = count
      carry = Buffer.from(window.subarray(Math.max(0, window.length - OVERLAP)))
      offset += bytesRead
    }
    await scanDeflated(file, reasons, pageCount)
    return { pageCount: pageCount.value, reasons: [...reasons] }
  } finally {
    await handle.close()
  }
}

/**
 * Object streams hide `/JavaScript` and `/Count`. Inflate each FlateDecode stream on its own and scan those
 * bytes, then drop them. A stream that would expand past the cap is skipped.
 */
async function scanDeflated(file: string, reasons: Set<string>, pageCount: { value: number | null }): Promise<void> {
  const handle = await open(file, 'r')
  try {
    const size = (await handle.stat()).size
    let offset = 0
    let carry = Buffer.alloc(0)
    let processed = 0
    const chunk = Buffer.alloc(READ_SIZE)
    while (offset < size) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset)
      if (bytesRead <= 0) break
      const window = Buffer.concat([carry, chunk.subarray(0, bytesRead)])
      const base = offset - carry.length
      let from = 0
      while (from < window.length) {
        const at = window.indexOf('stream', from)
        if (at < 0) break
        const dataAt = streamDataAt(window, at)
        const dict = window.subarray(Math.max(0, at - 800), at).toString('latin1')
        const length = /\/Length\s+(\d+)/.exec(dict)
        const flate = dict.includes('/FlateDecode')
        if (dataAt < 0 || !flate || !length) {
          from = at + 6
          continue
        }
        const n = Number(length[1])
        const filePos = base + dataAt
        if (n <= 0 || n > MAX_DEFLATED || filePos < processed) {
          from = at + 6
          continue
        }
        processed = filePos + n
        const compressed = Buffer.alloc(n)
        const read = await handle.read(compressed, 0, n, filePos)
        if (read.bytesRead === n) {
          try {
            const inflated = inflateSync(compressed, { maxOutputLength: MAX_INFLATED })
            for (const name of NAMES) {
              if (reasons.has(name.reason)) continue
              if (hasName(inflated, name.token)) reasons.add(name.reason)
            }
            const count = pagesCount(inflated)
            if (count != null && (pageCount.value == null || count > pageCount.value)) pageCount.value = count
          } catch {
            // A stream that will not inflate, or that expands past the cap, is not a reason to load the file.
          }
        }
        from = dataAt
      }
      carry = Buffer.from(window.subarray(Math.max(0, window.length - 1024)))
      offset += bytesRead
    }
  } finally {
    await handle.close()
  }
}

function streamDataAt(buf: Buffer, at: number): number {
  if (buf[at + 6] === 0x0d && buf[at + 7] === 0x0a) return at + 8
  if (buf[at + 6] === 0x0a) return at + 7
  return -1
}

/** The largest `/Count` on a `/Type /Pages` node in this window. Child trees are smaller than the root. */
function pagesCount(buf: Buffer): number | null {
  const needle = Buffer.from('/Pages')
  let from = 0
  let best: number | null = null
  while (from < buf.length) {
    const at = buf.indexOf(needle, from)
    if (at < 0) break
    const next = buf[at + needle.length]
    if (next === undefined || DELIMITERS.has(next)) {
      const slice = buf.subarray(Math.max(0, at - 200), Math.min(buf.length, at + needle.length + 200)).toString('latin1')
      const match = /\/Count\s+(\d{1,7})(?!\d)/.exec(slice)
      const count = match ? Number(match[1]) : 0
      if (count > 0 && (best == null || count > best)) best = count
    }
    from = at + 1
  }
  return best
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
