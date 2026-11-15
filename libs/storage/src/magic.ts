/**
 * The real type of a file from its bytes (§7.2: uploads are validated by content, not by the file name). Only the types
 * LVN accepts are recognised; anything else is null.
 *
 * Office files need more than a fixed prefix. A .doc or .ppt is an OLE compound file: the directory (and the FAT that
 * points at it) often sits in the last sectors, past the leading sample, and a large file lists its FAT through the
 * DIFAT chain. A .docx or .pptx is a zip: the part names live in the central directory at the end, not in the
 * compressed bytes. Sniffing reads those sectors or that directory and nothing else — no inflation — and stops on a
 * cap, a loop, or a bad header.
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
/** The compound-file header lists this many FAT sectors. Anything further is in the DIFAT sector chain. */
const HEADER_DIFAT_ENTRIES = 109
/** A 50 MB file of 512-byte sectors needs about 800 FAT sectors. More than this is not a document we will walk. */
const MAX_OLE_FAT_SECTORS = 1024
const MAX_DIFAT_SECTORS = 16
/** Directory sectors, the FAT sectors they touch, and the DIFAT sectors that locate those FAT sectors. */
const MAX_OLE_SECTOR_READS = MAX_OLE_DIRECTORY_SECTORS * 2 + MAX_DIFAT_SECTORS

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
 * it is accepted only when nothing else matched and the sample is UTF-8 without binary control bytes. `partial` means
 * the sample is a prefix of a larger file, so a multibyte character cut at the last byte can still be text.
 */
export function sameKind(declared: string, detected: string | null, sample: Uint8Array, partial = false): boolean {
  if (declared === detected) return true
  if (declared === 'text/plain') return detected === null && isPlainText(sample, partial)
  if (declared.startsWith('text/') && detected === null) return true
  return (declared === 'audio/webm' && detected === 'video/webm') || (declared === 'audio/mp4' && detected === 'video/mp4')
}

/**
 * UTF-8 text, a leading BOM allowed. NUL and the other C0/C1 controls (except tab, LF and CR) mean the sample is not
 * text, so a binary renamed to .txt does not pass. Invalid UTF-8 does not pass either. When `partial` is set, up to
 * three trailing bytes are ignored if they are a valid incomplete UTF-8 sequence and nothing else is.
 */
export function isPlainText(sample: Uint8Array, partial = false): boolean {
  if (sample.length === 0) return false
  const bytes = partial ? withoutCutUtf8Tail(sample) : sample
  if (!bytes || bytes.length === 0) return false
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
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
 * A prefix of a larger file may end in the middle of a character. Keep the sample when that tail is a well-formed
 * incomplete sequence of at most three bytes; reject any other tail.
 */
function withoutCutUtf8Tail(sample: Uint8Array): Uint8Array | null {
  const end = sample.length
  let continuations = 0
  while (continuations < 3 && continuations < end && isUtf8Continuation(sample[end - 1 - continuations]!)) continuations++
  const leadAt = end - 1 - continuations
  if (leadAt < 0) return null
  const lead = sample[leadAt]!
  const expected = utf8SequenceLength(lead)
  if (expected === null) return null
  const have = continuations + 1
  if (have === expected) return sample
  if (have > expected || !validUtf8Prefix(lead, have > 1 ? sample[leadAt + 1]! : null)) return null
  return sample.subarray(0, leadAt)
}

function isUtf8Continuation(byte: number): boolean {
  return (byte & 0xc0) === 0x80
}

function utf8SequenceLength(lead: number): number | null {
  if ((lead & 0x80) === 0) return 1
  if ((lead & 0xe0) === 0xc0) return lead >= 0xc2 ? 2 : null
  if ((lead & 0xf0) === 0xe0) return 3
  if ((lead & 0xf8) === 0xf0 && lead <= 0xf4) return 4
  return null
}

/** Overlongs and surrogate / out-of-range leads are not a character cut in half. */
function validUtf8Prefix(lead: number, firstContinuation: number | null): boolean {
  if (firstContinuation === null) return true
  if (!isUtf8Continuation(firstContinuation)) return false
  if (lead === 0xe0 && firstContinuation < 0xa0) return false
  if (lead === 0xed && firstContinuation > 0x9f) return false
  if (lead === 0xf0 && firstContinuation < 0x90) return false
  if (lead === 0xf4 && firstContinuation > 0x8f) return false
  return true
}

/**
 * Classify an object that may be larger than `head`. Images, PDF, audio and video are decided from the leading bytes.
 * A zip that continues past `head` is decided from its central directory, and an OLE file from the FAT and directory
 * sectors the header points at. `readRange` is asked only for those pieces.
 */
export async function sniffBytes(
  size: number,
  head: Uint8Array,
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
): Promise<string | null> {
  if (!Number.isInteger(size) || size < 0) return null
  const sample = head.length > size ? head.subarray(0, size) : head
  if (sample.length >= size) return detectMimeType(sample)
  if (isOle(sample)) return sniffOle(size, sample, readRange)
  if (!isZip(sample)) return detectMimeType(sample)
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

type OleHeader = {
  sectorSize: number
  firstDir: number
  fatCount: number
  /** The 109 FAT-sector numbers stored in the header. Unused slots are free-sector markers, not sector 0. */
  headerFat: number[]
  firstDifat: number
  difatCount: number
}

/** `ok` is the verdict. `need` is a sector that is inside the file but not loaded yet. */
type OleVerdict = { ok: string | null } | { need: number }

/**
 * OLE compound file. `WordDocument` is a .doc; `PowerPoint Document` is a .ppt. A workbook (or any other stream) is
 * not either, so declaring it as one fails the check. A truncated header, a sector past the buffer, or a directory
 * chain that loops is not a document.
 */
function detectOle(b: Uint8Array): string | null {
  const header = parseOleHeader(b)
  if (!header) return null
  const verdict = classifyOle(header, b.length, (sector) => {
    const offset = sectorOffset(sector, header.sectorSize)
    if (offset === null || offset + header.sectorSize > b.length) return null
    return b.subarray(offset, offset + header.sectorSize)
  })
  return 'need' in verdict ? null : verdict.ok
}

/**
 * The header is in `head`. FAT and directory sectors LibreOffice writes at the end of the file are read from
 * `readRange`, following the FAT chain and, past the 109 in-header entries, the DIFAT chain.
 */
async function sniffOle(
  size: number,
  head: Uint8Array,
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
): Promise<string | null> {
  const header = parseOleHeader(head)
  if (!header) return null
  const cache = new Map<number, Uint8Array>()
  const getSector = (sector: number): Uint8Array | null => {
    const cached = cache.get(sector)
    if (cached) return cached
    const offset = sectorOffset(sector, header.sectorSize)
    if (offset === null || offset + header.sectorSize > head.length) return null
    const slice = head.slice(offset, offset + header.sectorSize)
    cache.set(sector, slice)
    return slice
  }
  for (let reads = 0; reads <= MAX_OLE_SECTOR_READS; reads++) {
    const verdict = classifyOle(header, size, getSector)
    if (!('need' in verdict)) return verdict.ok
    if (reads === MAX_OLE_SECTOR_READS) return null
    const offset = sectorOffset(verdict.need, header.sectorSize)
    if (offset === null || offset + header.sectorSize > size) return null
    const bytes = await readRangeOrNull(readRange, offset, offset + header.sectorSize - 1, header.sectorSize)
    if (!bytes) return null
    cache.set(verdict.need, bytes.slice())
  }
  return null
}

function parseOleHeader(b: Uint8Array): OleHeader | null {
  if (b.length < 512 || !isOle(b)) return null
  const major = readU16(b, 0x1a)
  const order = readU16(b, 0x1c)
  const sectorShift = readU16(b, 0x1e)
  const miniShift = readU16(b, 0x20)
  const fatCount = readU32(b, 0x2c)
  const firstDir = readU32(b, 0x30)
  const firstDifat = readU32(b, 0x44)
  const difatCount = readU32(b, 0x48)
  if (order !== 0xfffe || miniShift !== 6 || firstDir === null || !isRegularSector(firstDir)) return null
  if (major === 3 && sectorShift !== 9) return null
  if (major === 4 && sectorShift !== 12) return null
  if ((major !== 3 && major !== 4) || sectorShift === null || fatCount === null || firstDifat === null || difatCount === null) return null
  const sectorSize = 1 << sectorShift
  if (sectorSize !== 512 && sectorSize !== 4096) return null
  if (fatCount < 1 || fatCount > MAX_OLE_FAT_SECTORS) return null
  if (difatCount > 0 && !isRegularSector(firstDifat)) return null
  const headerFat: number[] = []
  for (let i = 0; i < HEADER_DIFAT_ENTRIES; i++) {
    const sector = readU32(b, 0x4c + i * 4)
    if (sector === null) return null
    headerFat.push(sector)
  }
  return { sectorSize, firstDir, fatCount, headerFat, firstDifat, difatCount }
}

function classifyOle(header: OleHeader, fileSize: number, getSector: (sector: number) => Uint8Array | null): OleVerdict {
  const take = (sector: number): Uint8Array | OleVerdict => {
    if (!isRegularSector(sector) || !sectorFits(sector, header.sectorSize, fileSize)) return { ok: null }
    const bytes = getSector(sector)
    if (!bytes || bytes.length < header.sectorSize) return { need: sector }
    return bytes.subarray(0, header.sectorSize)
  }

  const seen = new Set<number>()
  let sector = header.firstDir
  let word = false
  let ppt = false
  for (let i = 0; i < MAX_OLE_DIRECTORY_SECTORS; i++) {
    if (!isRegularSector(sector) || seen.has(sector)) return { ok: null }
    seen.add(sector)
    const next = nextDirectorySector(header, sector, take)
    if (typeof next !== 'number') return next
    const loaded = take(sector)
    if (!(loaded instanceof Uint8Array)) return loaded
    const found = directoryNames(loaded)
    if (found === null) return { ok: null }
    word = word || found.word
    ppt = ppt || found.ppt
    if (next === OLE_ENDOFCHAIN) {
      if (word === ppt) return { ok: null }
      return { ok: word ? MSWORD : MSPPT }
    }
    if (!isRegularSector(next)) return { ok: null }
    sector = next
  }
  return { ok: null }
}

/** The FAT entry for a directory sector. `{ need }` when that FAT (or a DIFAT sector that locates it) is not loaded. */
function nextDirectorySector(
  header: OleHeader,
  sector: number,
  take: (sector: number) => Uint8Array | OleVerdict,
): number | OleVerdict {
  const perSector = header.sectorSize >>> 2
  if (perSector <= 1) return { ok: null }
  const fatIndex = Math.floor(sector / perSector)
  const within = sector % perSector
  const located = fatSectorNumber(header, fatIndex, take)
  if (typeof located !== 'number') return located
  const fat = take(located)
  if (!(fat instanceof Uint8Array)) return fat
  const next = readU32(fat, within * 4)
  if (next === null) return { ok: null }
  return next
}

function fatSectorNumber(header: OleHeader, fatIndex: number, take: (sector: number) => Uint8Array | OleVerdict): number | OleVerdict {
  if (!Number.isInteger(fatIndex) || fatIndex < 0 || fatIndex >= header.fatCount) return { ok: null }
  if (fatIndex < HEADER_DIFAT_ENTRIES) {
    const sector = header.headerFat[fatIndex]
    if (sector === undefined || !isRegularSector(sector)) return { ok: null }
    return sector
  }
  let remaining = fatIndex - HEADER_DIFAT_ENTRIES
  let difat = header.firstDifat
  const seen = new Set<number>()
  const limit = Math.min(header.difatCount, MAX_DIFAT_SECTORS)
  for (let i = 0; i < limit; i++) {
    if (!isRegularSector(difat) || seen.has(difat)) return { ok: null }
    seen.add(difat)
    const loaded = take(difat)
    if (!(loaded instanceof Uint8Array)) return loaded
    const pointers = (header.sectorSize >>> 2) - 1
    if (pointers < 1) return { ok: null }
    if (remaining < pointers) {
      const sector = readU32(loaded, remaining * 4)
      if (sector === null || !isRegularSector(sector)) return { ok: null }
      return sector
    }
    remaining -= pointers
    const next = readU32(loaded, pointers * 4)
    if (next === null || !isRegularSector(next)) return { ok: null }
    difat = next
  }
  return { ok: null }
}

function isRegularSector(sector: number): boolean {
  return sector <= MAX_REGULAR_SECTOR
}

function sectorOffset(sector: number, sectorSize: number): number | null {
  const offset = (sector + 1) * sectorSize
  if (!Number.isSafeInteger(offset) || offset < sectorSize) return null
  return offset
}

function sectorFits(sector: number, sectorSize: number, fileSize: number): boolean {
  const offset = sectorOffset(sector, sectorSize)
  return offset !== null && fileSize >= offset + sectorSize
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
