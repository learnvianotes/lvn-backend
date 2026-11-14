/**
 * The real type of a file from its bytes (§7.2: uploads are validated by content, not by the file name). Only the types
 * LVN accepts are recognised; anything else is null.
 *
 * Office files need more than a fixed prefix. OLE directories sit in sectors just after the 512-byte header. A .docx
 * or .pptx is a zip: the part names live in the central directory at the end, not in the compressed bytes. Sniffing
 * reads that directory (or the OLE directory) and nothing else — no inflation — and stops on a cap or a bad header.
 */
const ZIP_LOCAL = 0x04034b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_EOCD = 0x06054b50
/** EOCD plus the longest legal comment. Enough to find the directory; the directory itself is read separately. */
const ZIP_TAIL_BYTES = 64 * 1024 + 22
/** A real Word or PowerPoint package's directory is far smaller. Anything larger is refused rather than read. */
const MAX_CENTRAL_DIRECTORY_BYTES = 1024 * 1024
/** Safety stop. A 1 MB directory cannot hold this many 46-byte headers, so a well-formed directory is read to its end. */
const MAX_ZIP_ENTRIES = 8192
const MAX_ZIP_NAME = 1024

const OLE_ENDOFCHAIN = 0xfffffffe
const MAX_REGULAR_SECTOR = 0xfffffffa
const MAX_OLE_DIRECTORY_SECTORS = 32

const MSWORD = 'application/msword'
const MSPPT = 'application/vnd.ms-powerpoint'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Leading bytes read for images, PDF, audio, video, OLE, and the plain-text sample. */
export const MIME_SAMPLE_BYTES = 256 * 1024

export function detectMimeType(b: Uint8Array): string | null {
  if (at(b, 0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(b, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp'
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return 'image/gif'
  if (ascii(b, 0, '%PDF-')) return 'application/pdf'
  if (isOle(b)) return detectOle(b)
  if (isZip(b)) return detectZip(b)
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12))
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
    if (brand === 'M4A ') return 'audio/mp4'
    if (brand === 'qt  ') return 'video/quicktime'
    return 'video/mp4'
  }
  if (ascii(b, 0, 'OggS')) return 'audio/ogg'
  if (ascii(b, 0, 'ID3') || at(b, 0, 0xff, 0xfb) || at(b, 0, 0xff, 0xf3) || at(b, 0, 0xff, 0xf2)) return 'audio/mpeg'
  if (at(b, 0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE')) return 'audio/wav'
  return null
}

/**
 * Whether the bytes are what was declared. WebM and MP4 are containers: a recording made in the browser is audio/webm
 * whose bytes look like video/webm, and many .m4a files carry an MP4 brand. Plain text has no signature of its own:
 * it is accepted only when nothing else matched and the sample is UTF-8 without binary control bytes.
 */
export function sameKind(declared: string, detected: string | null, sample: Uint8Array): boolean {
  if (declared === detected) return true
  if (declared === 'text/plain') return detected === null && isPlainText(sample)
  if (declared.startsWith('text/') && detected === null) return true
  return (declared === 'audio/webm' && detected === 'video/webm') || (declared === 'audio/mp4' && detected === 'video/mp4')
}

/**
 * UTF-8 text, a leading BOM allowed. NUL and the other C0/C1 controls (except tab, LF and CR) mean the sample is not
 * text, so a binary renamed to .txt does not pass. Invalid UTF-8 does not pass either.
 */
export function isPlainText(sample: Uint8Array): boolean {
  if (sample.length === 0) return false
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(sample)
  } catch {
    return false
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) return false
  }
  return true
}

/**
 * Classify an object that may be larger than `head`. Images, PDF, audio, video and OLE are decided from the leading
 * bytes. A zip that continues past `head` is decided from its central directory: `readRange` is asked only for the
 * tail (to find the end record) and, when that tail does not already hold it, the directory itself.
 */
export async function sniffBytes(
  size: number,
  head: Uint8Array,
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
): Promise<string | null> {
  if (!Number.isInteger(size) || size < 0) return null
  const sample = head.length > size ? head.subarray(0, size) : head
  if (sample.length >= size || !isZip(sample)) return detectMimeType(sample)
  const tailLen = Math.min(size, ZIP_TAIL_BYTES)
  const tailStart = size - tailLen
  const tail = await readRangeOrNull(readRange, tailStart, size - 1, tailLen)
  if (!tail) return 'application/zip'
  const located = locateCentral(size, tail, tailStart)
  if (located === null || located === 'malformed' || located.length === 0) return 'application/zip'
  const central = await centralBytes(located, tail, tailStart, readRange)
  if (!central) return 'application/zip'
  return mimeFromCentral(central)
}

function at(b: Uint8Array, offset: number, ...bytes: number[]): boolean {
  return bytes.every((v, i) => b[offset + i] === v)
}

function ascii(b: Uint8Array, offset: number, text: string): boolean {
  return at(b, offset, ...[...text].map((c) => c.charCodeAt(0)))
}

function readU16(b: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > b.length) return null
  const lo = b[offset]
  const hi = b[offset + 1]
  if (lo === undefined || hi === undefined) return null
  return lo | (hi << 8)
}

function readU32(b: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > b.length) return null
  const b0 = b[offset]
  const b1 = b[offset + 1]
  const b2 = b[offset + 2]
  const b3 = b[offset + 3]
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) return null
  return (b0 + (b1 << 8) + (b2 << 16) + b3 * 0x1000000) >>> 0
}

function isZip(b: Uint8Array): boolean {
  const sig = readU32(b, 0)
  return sig === ZIP_LOCAL || sig === ZIP_EOCD
}

/** A whole zip buffer: the central directory is trusted, and a missing or broken one stays a plain zip. */
function detectZip(b: Uint8Array): string {
  const located = locateCentral(b.length, b, 0)
  if (located === null || located === 'malformed' || located.length === 0) return 'application/zip'
  return mimeFromCentral(b.subarray(located.start, located.start + located.length))
}

/**
 * Find the central directory from the end-of-central-directory record in `tail` (a suffix of the file starting at
 * `tailStart`). `null` when that record is not in the suffix. `'malformed'` when it is present but the sizes cannot
 * be a directory we are willing to read (zip64 sentinels, a second disk, or a directory bigger than the cap).
 */
function locateCentral(fileSize: number, tail: Uint8Array, tailStart: number): { start: number; length: number } | 'malformed' | null {
  if (!Number.isSafeInteger(fileSize) || fileSize < 0 || tailStart < 0 || tailStart > fileSize) return 'malformed'
  const eocdRel = findEocd(tail)
  if (eocdRel === null) return null
  const disk = readU16(tail, eocdRel + 4)
  const cdDisk = readU16(tail, eocdRel + 6)
  const total = readU16(tail, eocdRel + 10)
  const cdSize = readU32(tail, eocdRel + 12)
  const cdOffset = readU32(tail, eocdRel + 16)
  if (disk === null || cdDisk === null || total === null || cdSize === null || cdOffset === null) return 'malformed'
  if (disk !== 0 || cdDisk !== 0) return 'malformed'
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || total === 0xffff) return 'malformed'
  if (cdSize > MAX_CENTRAL_DIRECTORY_BYTES) return 'malformed'
  if (cdOffset > fileSize || cdSize > fileSize - cdOffset) return 'malformed'
  const eocdAbs = tailStart + eocdRel
  if (!Number.isSafeInteger(eocdAbs) || cdOffset + cdSize > eocdAbs) return 'malformed'
  return { start: cdOffset, length: cdSize }
}

function findEocd(tail: Uint8Array): number | null {
  if (tail.length < 22) return null
  const min = tail.length - Math.min(tail.length, 65535 + 22)
  for (let i = tail.length - 22; i >= min; i--) {
    if (readU32(tail, i) !== ZIP_EOCD) continue
    const commentLen = readU16(tail, i + 20)
    if (commentLen === null) continue
    if (i + 22 + commentLen === tail.length) return i
  }
  return null
}

function mimeFromCentral(cd: Uint8Array): string {
  const names: string[] = []
  let offset = 0
  while (offset < cd.length && names.length < MAX_ZIP_ENTRIES) {
    if (offset + 46 > cd.length || readU32(cd, offset) !== ZIP_CENTRAL) return 'application/zip'
    const nameLen = readU16(cd, offset + 28)
    const extraLen = readU16(cd, offset + 30)
    const commentLen = readU16(cd, offset + 32)
    if (nameLen === null || extraLen === null || commentLen === null) return 'application/zip'
    const next = offset + 46 + nameLen + extraLen + commentLen
    if (!Number.isSafeInteger(next) || next < offset + 46 || next > cd.length) return 'application/zip'
    if (nameLen <= MAX_ZIP_NAME) {
      const name = decodeZipName(cd.subarray(offset + 46, offset + 46 + nameLen))
      if (name === null) return 'application/zip'
      names.push(name)
    }
    offset = next
  }
  // A directory that stops early for any reason other than the entry cap is not a package we can trust.
  if (offset !== cd.length && names.length < MAX_ZIP_ENTRIES) return 'application/zip'
  return classifyOfficeZip(names) ?? 'application/zip'
}

function decodeZipName(raw: Uint8Array): string | null {
  for (const byte of raw) if (byte === 0) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw)
  } catch {
    let name = ''
    for (const byte of raw) name += String.fromCharCode(byte)
    return name
  }
}

function zipParts(name: string): string[] | null {
  const slash = name.replaceAll('\\', '/')
  if (slash.split('/').some((part) => part === '.' || part === '..')) return null
  return slash.split('/').filter((part) => part.length > 0)
}

function isContentTypes(name: string): boolean {
  const parts = zipParts(name)
  return parts !== null && parts.length === 1 && parts[0] === '[Content_Types].xml'
}

/** `word/` or `ppt/` as a package directory, not a file that merely begins with those letters. */
function isPackageDir(name: string, dir: string): boolean {
  const parts = zipParts(name)
  if (!parts || parts[0] !== dir) return false
  return parts.length > 1 || name.replaceAll('\\', '/').endsWith('/')
}

function classifyOfficeZip(names: string[]): string | null {
  if (!names.some(isContentTypes)) return null
  const word = names.some((name) => isPackageDir(name, 'word'))
  const ppt = names.some((name) => isPackageDir(name, 'ppt'))
  if (word === ppt) return null
  return word ? DOCX : PPTX
}

async function readRangeOrNull(
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
  start: number,
  endInclusive: number,
  expected: number,
): Promise<Uint8Array | null> {
  try {
    const bytes = await readRange(start, endInclusive)
    return bytes.length === expected ? bytes : null
  } catch {
    return null
  }
}

async function centralBytes(
  located: { start: number; length: number },
  tail: Uint8Array,
  tailStart: number,
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
): Promise<Uint8Array | null> {
  const end = located.start + located.length
  if (located.start >= tailStart && end <= tailStart + tail.length) return tail.subarray(located.start - tailStart, located.start - tailStart + located.length)
  return readRangeOrNull(readRange, located.start, end - 1, located.length)
}

function isOle(b: Uint8Array): boolean {
  return at(b, 0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
}

/**
 * OLE compound file. `WordDocument` is a .doc; `PowerPoint Document` is a .ppt. A workbook (or any other stream) is
 * not either, so declaring it as one fails the check. A truncated header, a sector past the buffer, or a directory
 * chain that loops is not a document.
 */
function detectOle(b: Uint8Array): string | null {
  if (b.length < 512) return null
  const major = readU16(b, 0x1a)
  const order = readU16(b, 0x1c)
  const sectorShift = readU16(b, 0x1e)
  const miniShift = readU16(b, 0x20)
  const firstDir = readU32(b, 0x30)
  if (order !== 0xfffe || miniShift !== 6 || firstDir === null || !isRegularSector(firstDir)) return null
  if (major === 3 && sectorShift !== 9) return null
  if (major === 4 && sectorShift !== 12) return null
  if ((major !== 3 && major !== 4) || sectorShift === null) return null
  const sectorSize = 1 << sectorShift
  const sectors: number[] = []
  const seen = new Set<number>()
  let sector = firstDir
  while (sectors.length < MAX_OLE_DIRECTORY_SECTORS) {
    if (seen.has(sector)) return null
    seen.add(sector)
    const offset = sectorOffset(sector, sectorSize)
    if (offset === null || offset + sectorSize > b.length) return null
    sectors.push(sector)
    const next = fatEntry(b, sector, sectorSize)
    if (next === null) return null
    if (next === OLE_ENDOFCHAIN) break
    if (!isRegularSector(next)) return null
    sector = next
  }
  if (sectors.length === MAX_OLE_DIRECTORY_SECTORS && fatEntry(b, sectors[sectors.length - 1] ?? sector, sectorSize) !== OLE_ENDOFCHAIN) return null
  let word = false
  let ppt = false
  for (const dirSector of sectors) {
    const offset = sectorOffset(dirSector, sectorSize)
    if (offset === null) return null
    const found = directoryNames(b.subarray(offset, offset + sectorSize))
    if (found === null) return null
    word = word || found.word
    ppt = ppt || found.ppt
  }
  if (word === ppt) return null
  return word ? MSWORD : MSPPT
}

function isRegularSector(sector: number): boolean {
  return sector <= MAX_REGULAR_SECTOR
}

function sectorOffset(sector: number, sectorSize: number): number | null {
  const offset = (sector + 1) * sectorSize
  if (!Number.isSafeInteger(offset) || offset < sectorSize) return null
  return offset
}

/** The next sector in a chain, from the FAT linked in the header. Only the 109 in-header entries are followed. */
function fatEntry(b: Uint8Array, sector: number, sectorSize: number): number | null {
  const perSector = sectorSize >>> 2
  if (perSector <= 0) return null
  const fatIndex = Math.floor(sector / perSector)
  const within = sector % perSector
  if (fatIndex >= 109) return null
  const fatSector = readU32(b, 0x4c + fatIndex * 4)
  if (fatSector === null || !isRegularSector(fatSector)) return null
  const base = sectorOffset(fatSector, sectorSize)
  if (base === null) return null
  return readU32(b, base + within * 4)
}

function directoryNames(sector: Uint8Array): { word: boolean; ppt: boolean } | null {
  let word = false
  let ppt = false
  for (let i = 0; i + 128 <= sector.length; i += 128) {
    const type = sector[i + 66]
    if (type === undefined || type === 0) continue
    if (type !== 1 && type !== 2 && type !== 5) return null
    const name = directoryName(sector.subarray(i, i + 128))
    if (name === null) return null
    if (type === 2 && name === 'WordDocument') word = true
    if (type === 2 && name === 'PowerPoint Document') ppt = true
  }
  return { word, ppt }
}

function directoryName(entry: Uint8Array): string | null {
  const nameLen = readU16(entry, 64)
  if (nameLen === null || nameLen < 2 || nameLen > 64 || nameLen % 2 !== 0) return null
  if (entry[nameLen - 2] !== 0 || entry[nameLen - 1] !== 0) return null
  try {
    return new TextDecoder('utf-16le', { fatal: true }).decode(entry.subarray(0, nameLen - 2))
  } catch {
    return null
  }
}
