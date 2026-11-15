import { detectMimeType, MIME_SAMPLE_BYTES, sameKind, sniffBytes } from '../../src/magic'

const MSWORD = 'application/msword'
const MSPPT = 'application/vnd.ms-powerpoint'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])

const text = (value: string) => new TextEncoder().encode(value)

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function u16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff]
}

function u32(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
}

/** A stored zip. The central directory carries the names; payloads are never inflated. */
function zip(entries: { name: string; data?: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = text(entry.name)
    const data = entry.data ?? new Uint8Array()
    const local = new Uint8Array(30 + name.length + data.length)
    local.set(u32(0x04034b50), 0)
    local.set(u32(data.length), 18)
    // Claim an absurd uncompressed size. Classification must not allocate or inflate from it.
    local.set(u32(0xffffffff), 22)
    local.set(u16(name.length), 26)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)
    const central = new Uint8Array(46 + name.length)
    central.set(u32(0x02014b50), 0)
    central.set(u32(data.length), 20)
    central.set(u32(0xffffffff), 24)
    central.set(u16(name.length), 28)
    central.set(u32(offset), 42)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }
  const cd = concat(centrals)
  const eocd = new Uint8Array(22)
  eocd.set(u32(0x06054b50), 0)
  eocd.set(u16(entries.length), 8)
  eocd.set(u16(entries.length), 10)
  eocd.set(u32(cd.length), 12)
  eocd.set(u32(offset), 16)
  return concat([...locals, cd, eocd])
}

function writeU16(b: Uint8Array, offset: number, n: number) {
  b[offset] = n & 0xff
  b[offset + 1] = (n >> 8) & 0xff
}

function writeU32(b: Uint8Array, offset: number, n: number) {
  b[offset] = n & 0xff
  b[offset + 1] = (n >> 8) & 0xff
  b[offset + 2] = (n >> 16) & 0xff
  b[offset + 3] = (n >>> 24) & 0xff
}

/** A minimal OLE compound file: header, one FAT sector, one directory sector. */
function cfb(streams: { name: string; type?: number }[]): Uint8Array {
  const sector = 512
  const header = new Uint8Array(sector)
  header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0)
  writeU16(header, 0x1a, 3)
  writeU16(header, 0x1c, 0xfffe)
  writeU16(header, 0x1e, 9)
  writeU16(header, 0x20, 6)
  writeU32(header, 0x2c, 1)
  writeU32(header, 0x30, 1)
  const fat = new Uint8Array(sector)
  writeU32(fat, 0, 0xfffffffd)
  writeU32(fat, 4, 0xfffffffe)
  const dir = new Uint8Array(sector)
  writeEntry(dir, 0, 'Root Entry', 5)
  streams.forEach((stream, i) => writeEntry(dir, i + 1, stream.name, stream.type ?? 2))
  const out = new Uint8Array(sector * 3)
  out.set(header, 0)
  out.set(fat, sector)
  out.set(dir, sector * 2)
  return out
}

function writeEntry(dir: Uint8Array, index: number, name: string, type: number) {
  const at = index * 128
  for (let i = 0; i < name.length; i++) dir[at + i * 2] = name.charCodeAt(i) & 0xff
  writeU16(dir, at + 64, (name.length + 1) * 2)
  dir[at + 66] = type
}

const doc = () => cfb([{ name: 'WordDocument' }])
const ppt = () => cfb([{ name: 'PowerPoint Document' }])
const docx = () => zip([
  { name: '[Content_Types].xml', data: text('<Types></Types>') },
  { name: 'word/document.xml', data: text('<w:document/>') },
])
const pptx = () => zip([
  { name: '[Content_Types].xml', data: text('<Types></Types>') },
  { name: 'ppt/presentation.xml', data: text('<p:presentation/>') },
])

describe('detectMimeType', () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    [[...PNG], 'image/png'],
    [[...Buffer.from('%PDF-1.7')], 'application/pdf'],
    [[...Buffer.from('RIFF\0\0\0\0WEBPVP8 ')], 'image/webp'],
    [[...Buffer.from('\0\0\0\x18ftypmp42')], 'video/mp4'],
    [[...Buffer.from('\0\0\0\x14ftypqt  ')], 'video/quicktime'],
    [[...Buffer.from('\0\0\0\x20ftypM4A ')], 'audio/mp4'],
    [[...Buffer.from('\0\0\0\x18ftypheic')], 'image/heic'],
    [[0x1a, 0x45, 0xdf, 0xa3], 'video/webm'],
    [[...Buffer.from('ID3\x04')], 'audio/mpeg'],
    [[...Buffer.from('OggS')], 'audio/ogg'],
    [[...Buffer.from('RIFF\0\0\0\0WAVEfmt ')], 'audio/wav'],
    [[...Buffer.from('GIF89a')], 'image/gif'],
    [[...Buffer.from('GIF87a')], 'image/gif'],
    [[0x50, 0x4b, 0x03, 0x04], 'application/zip'],
    [[0x50, 0x4b, 0x05, 0x06], 'application/zip'],
    [[...Buffer.from('<html><script>')], null],
    [[0x4d, 0x5a, 0x90, 0x00], null],
  ])('%j is %s', (bytes, type) => {
    expect(detectMimeType(Uint8Array.from(bytes as number[]))).toBe(type)
  })

  it('accepts a Word document and a PowerPoint presentation from their directory streams', () => {
    expect(detectMimeType(doc())).toBe(MSWORD)
    expect(detectMimeType(ppt())).toBe(MSPPT)
    expect(sameKind(MSWORD, detectMimeType(doc()), doc())).toBe(true)
    expect(sameKind(MSPPT, detectMimeType(ppt()), ppt())).toBe(true)
  })

  it('rejects an OLE file whose stream is not the declared document', () => {
    const sheet = cfb([{ name: 'Workbook' }, { name: 'WordDocument', type: 0 }])
    expect(detectMimeType(sheet)).toBeNull()
    expect(sameKind(MSWORD, detectMimeType(sheet), sheet)).toBe(false)
    expect(sameKind(MSPPT, detectMimeType(doc()), doc())).toBe(false)
    expect(detectMimeType(cfb([{ name: 'WordDocument' }, { name: 'PowerPoint Document' }]))).toBeNull()
  })

  it('rejects a truncated or looping OLE file', () => {
    const whole = doc()
    expect(detectMimeType(whole.subarray(0, 16))).toBeNull()
    expect(detectMimeType(whole.subarray(0, 600))).toBeNull()
    const broken = doc()
    broken[0x1c] = 0
    expect(detectMimeType(broken)).toBeNull()
    const loop = doc()
    writeU32(loop, 512 + 4, 1)
    expect(detectMimeType(loop)).toBeNull()
    expect(sameKind(MSWORD, null, loop)).toBe(false)
  })

  it('accepts docx and pptx from the central directory and rejects a zip wearing their names', () => {
    const word = docx()
    const slides = pptx()
    expect(detectMimeType(word)).toBe(DOCX)
    expect(detectMimeType(slides)).toBe(PPTX)
    expect(sameKind(DOCX, detectMimeType(word), word)).toBe(true)
    expect(sameKind(PPTX, detectMimeType(slides), slides)).toBe(true)
    expect(sameKind(PPTX, detectMimeType(word), word)).toBe(false)

    const renamed = zip([{ name: 'readme.txt', data: text('hello') }])
    expect(detectMimeType(renamed)).toBe('application/zip')
    expect(sameKind(DOCX, detectMimeType(renamed), renamed)).toBe(false)
    expect(sameKind(PPTX, detectMimeType(renamed), renamed)).toBe(false)

    const spreadsheet = zip([
      { name: '[Content_Types].xml', data: text('<Types></Types>') },
      { name: 'xl/workbook.xml', data: text('<x/>') },
    ])
    expect(detectMimeType(spreadsheet)).toBe('application/zip')
    expect(sameKind(DOCX, detectMimeType(spreadsheet), spreadsheet)).toBe(false)

    const escaped = zip([
      { name: '[Content_Types].xml', data: text('<Types></Types>') },
      { name: 'word/../ppt/slide.xml', data: text('<p/>') },
    ])
    expect(detectMimeType(escaped)).toBe('application/zip')
  })

  it('rejects a truncated or malformed zip instead of trusting a partial name', () => {
    const whole = docx()
    const truncated = whole.subarray(0, 40)
    expect(detectMimeType(truncated)).toBe('application/zip')
    expect(sameKind(DOCX, detectMimeType(truncated), truncated)).toBe(false)

    const malformed = docx()
    const central = malformed.findIndex((_, i) => malformed[i] === 0x50 && malformed[i + 1] === 0x4b && malformed[i + 2] === 0x01 && malformed[i + 3] === 0x02)
    expect(central).toBeGreaterThan(0)
    malformed[central] = 0
    expect(detectMimeType(malformed)).toBe('application/zip')
    expect(sameKind(PPTX, detectMimeType(malformed), malformed)).toBe(false)

    const claimed = new Uint8Array(64)
    claimed.set([0x50, 0x4b, 0x03, 0x04], 0)
    claimed.set([0x50, 0x4b, 0x05, 0x06], 42)
    claimed[42 + 12] = 0xff
    claimed[42 + 13] = 0xff
    claimed[42 + 14] = 0xff
    claimed[42 + 15] = 0x7f
    expect(() => detectMimeType(claimed)).not.toThrow()
    expect(detectMimeType(claimed)).toBe('application/zip')
  })

  it('reads a large zip from its tail and central directory, not from the bytes in between', async () => {
    const padding = Array.from({ length: 80 }, (_, i) => ({ name: `${'p'.repeat(900)}-${i}.bin`, data: new Uint8Array(1) }))
    const file = zip([
      { name: '[Content_Types].xml', data: text('<Types></Types>') },
      { name: 'word/document.xml', data: new Uint8Array(MIME_SAMPLE_BYTES) },
      ...padding,
    ])
    expect(file.length).toBeGreaterThan(MIME_SAMPLE_BYTES + 64 * 1024)
    const reads: Array<[number, number]> = []
    const detected = await sniffBytes(file.length, file.subarray(0, MIME_SAMPLE_BYTES), async (start, end) => {
      reads.push([start, end])
      return file.subarray(start, end + 1)
    })
    expect(detected).toBe(DOCX)
    expect(reads.length).toBeGreaterThan(0)
    const tailStart = file.length - (64 * 1024 + 22)
    expect(reads.some(([start]) => start >= tailStart)).toBe(true)
    expect(reads.every(([start, end]) => end - start < 1024 * 1024)).toBe(true)
    const middle = Math.floor(MIME_SAMPLE_BYTES + (tailStart - MIME_SAMPLE_BYTES) / 2)
    expect(reads.some(([start, end]) => start <= middle && end >= middle)).toBe(false)
  })

  it('leaves a non-zip sample alone', async () => {
    const reads: number[] = []
    await expect(sniffBytes(PNG.length, PNG, async () => {
      reads.push(1)
      return new Uint8Array()
    })).resolves.toBe('image/png')
    expect(reads).toEqual([])
  })
})

describe('OLE files larger than the sample', () => {
  const END = 0xfffffffe
  const FREE = 0xffffffff

  function oleHeader(fields: { fatCount: number; firstDir: number; fats?: Array<[number, number]>; firstDifat?: number; difatCount?: number }): Uint8Array {
    const header = new Uint8Array(512)
    header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0)
    writeU16(header, 0x1a, 3)
    writeU16(header, 0x1c, 0xfffe)
    writeU16(header, 0x1e, 9)
    writeU16(header, 0x20, 6)
    writeU32(header, 0x2c, fields.fatCount)
    writeU32(header, 0x30, fields.firstDir)
    writeU32(header, 0x44, fields.firstDifat ?? END)
    writeU32(header, 0x48, fields.difatCount ?? 0)
    for (let i = 0; i < 109; i++) writeU32(header, 0x4c + i * 4, FREE)
    for (const [index, sector] of fields.fats ?? []) writeU32(header, 0x4c + index * 4, sector)
    return header
  }

  function directorySector(name: string): Uint8Array {
    const dir = new Uint8Array(512)
    writeEntry(dir, 0, 'Root Entry', 5)
    writeEntry(dir, 1, name, 2)
    return dir
  }

  function fatSector(entries: Array<[number, number]>): Uint8Array {
    const fat = new Uint8Array(512)
    for (const [index, value] of entries) writeU32(fat, index * 4, value)
    return fat
  }

  function headOf(header: Uint8Array): Uint8Array {
    const head = new Uint8Array(MIME_SAMPLE_BYTES)
    head.set(header, 0)
    return head
  }

  async function sniffSectors(size: number, header: Uint8Array, sectors: Map<number, Uint8Array>) {
    const reads: Array<[number, number]> = []
    const detected = await sniffBytes(size, headOf(header), async (start, end) => {
      reads.push([start, end])
      const length = end - start + 1
      const sector = start / 512 - 1
      const bytes = sectors.get(sector)
      if (length !== 512 || !Number.isInteger(sector) || !bytes) return new Uint8Array()
      return bytes
    })
    return { detected, reads }
  }

  it('reads a Word and a PowerPoint directory that sit past the 256 KB sample', async () => {
    const fatAt = 520
    const firstDir = 530
    const secondDir = 531
    // Sector N occupies bytes [(N + 1) * 512, (N + 2) * 512). Both the FAT and the directory are past the sample.
    const size = (secondDir + 2) * 512
    expect((fatAt + 1) * 512).toBeGreaterThan(MIME_SAMPLE_BYTES)
    const header = oleHeader({ fatCount: 5, firstDir, fats: [[4, fatAt]] })
    const rootOnly = new Uint8Array(512)
    writeEntry(rootOnly, 0, 'Root Entry', 5)
    // The stream name is in the second directory sector, so the FAT chain has to be followed past the sample.
    const sectors = new Map<number, Uint8Array>([
      [fatAt, fatSector([[firstDir % 128, secondDir], [secondDir % 128, END]])],
      [firstDir, rootOnly],
      [secondDir, directorySector('WordDocument')],
    ])

    const word = await sniffSectors(size, header, sectors)
    expect(word.detected).toBe(MSWORD)
    expect(word.reads.length).toBeGreaterThan(0)
    expect(word.reads.every(([start, end]) => start >= MIME_SAMPLE_BYTES && end - start + 1 === 512)).toBe(true)

    const slides = new Map<number, Uint8Array>([
      [fatAt, fatSector([[firstDir % 128, END]])],
      [firstDir, directorySector('PowerPoint Document')],
    ])
    const ppt = await sniffSectors((firstDir + 2) * 512, header, slides)
    expect(ppt.detected).toBe(MSPPT)
    expect(sameKind(MSWORD, ppt.detected, headOf(header), true)).toBe(false)
    expect(ppt.reads.every(([start]) => start >= MIME_SAMPLE_BYTES)).toBe(true)

    const sheet = new Map<number, Uint8Array>([
      [fatAt, fatSector([[firstDir % 128, END]])],
      [firstDir, directorySector('Workbook')],
    ])
    const xls = await sniffSectors((firstDir + 2) * 512, header, sheet)
    expect(xls.detected).toBeNull()
    expect(sameKind(MSWORD, xls.detected, headOf(header), true)).toBe(false)
  })

  it('follows the DIFAT chain when the directory is past the 109 in-header FAT sectors', async () => {
    const dir = 109 * 128
    const fatAt = dir + 1
    const difatAt = dir + 2
    const size = (difatAt + 2) * 512
    // Sector 109 * 128 is the first one whose FAT entry lives past the 109 in-header slots (a ~7 MB presentation).
    expect(Math.floor(dir / 128)).toBe(109)
    expect((difatAt + 1) * 512).toBeGreaterThan(MIME_SAMPLE_BYTES)
    const header = oleHeader({ fatCount: 110, firstDir: dir, firstDifat: difatAt, difatCount: 1 })
    const difat = new Uint8Array(512)
    writeU32(difat, 0, fatAt)
    writeU32(difat, 127 * 4, END)
    const sectors = new Map<number, Uint8Array>([
      [difatAt, difat],
      [fatAt, fatSector([[dir % 128, END]])],
      [dir, directorySector('PowerPoint Document')],
    ])
    const found = await sniffSectors(size, header, sectors)
    expect(found.detected).toBe(MSPPT)
    expect(found.reads.map(([start]) => start / 512 - 1).sort((a, b) => a - b)).toEqual([fatAt, difatAt, dir].sort((a, b) => a - b))
    expect(found.reads.every(([start, end]) => start >= MIME_SAMPLE_BYTES && end - start + 1 === 512)).toBe(true)

    const looped = new Uint8Array(difat)
    writeU32(looped, 127 * 4, difatAt)
    const farDir = (109 + 127) * 128
    const looping = oleHeader({ fatCount: 110 + 127, firstDir: farDir, firstDifat: difatAt, difatCount: 4 })
    const stuck = await sniffSectors((difatAt + 2) * 512, looping, new Map([[difatAt, looped]]))
    expect(stuck.detected).toBeNull()
    expect(stuck.reads.length).toBeLessThan(6)
  })

  it('rejects a malformed OLE file without reading the whole object', async () => {
    const fatAt = 520
    const dir = 530
    const size = (dir + 2) * 512
    const header = oleHeader({ fatCount: 5, firstDir: dir, fats: [[4, fatAt]] })
    const missing = await sniffSectors(size, header, new Map([[fatAt, fatSector([[dir % 128, dir]])], [dir, directorySector('WordDocument')]]))
    expect(missing.detected).toBeNull()
    expect(missing.reads.length).toBeGreaterThan(0)
    expect(missing.reads.every(([start, end]) => end - start + 1 === 512 && end < size)).toBe(true)

    const thrown = await sniffBytes(size, headOf(header), async () => {
      throw new Error('storage')
    })
    expect(thrown).toBeNull()

    const short = await sniffBytes(size, headOf(header), async () => new Uint8Array(8))
    expect(short).toBeNull()
  })
})

describe('plain text', () => {
  function cutAtSample(glyph: string, bytesInSample: number): { sample: Uint8Array; whole: Uint8Array } {
    const glyphBytes = text(glyph)
    const whole = new Uint8Array(MIME_SAMPLE_BYTES + glyphBytes.length - bytesInSample)
    whole.fill(0x61)
    whole.set(glyphBytes, MIME_SAMPLE_BYTES - bytesInSample)
    return { sample: whole.subarray(0, MIME_SAMPLE_BYTES), whole }
  }

  it('accepts UTF-8, including a BOM, and rejects binary renamed as text', () => {
    const note = text('Notes\nfor class\t1\r\n')
    expect(detectMimeType(note)).toBeNull()
    expect(sameKind('text/plain', null, note)).toBe(true)
    const bom = concat([Uint8Array.from([0xef, 0xbb, 0xbf]), text('नमस्ते')])
    expect(sameKind('text/plain', null, bom)).toBe(true)

    const nul = concat([text('hello'), Uint8Array.from([0])])
    expect(sameKind('text/plain', null, nul)).toBe(false)
    expect(sameKind('text/plain', null, Uint8Array.from([0x41, 0x01, 0x42]))).toBe(false)
    expect(sameKind('text/plain', null, Uint8Array.from([0xff, 0xfe, 0x00, 0x00]))).toBe(false)
    expect(sameKind('text/plain', detectMimeType(PNG), PNG)).toBe(false)
    expect(sameKind('text/plain', detectMimeType(doc()), doc())).toBe(false)
    expect(sameKind('text/plain', detectMimeType(docx()), docx())).toBe(false)
  })

  it('accepts a Hindi or Telugu character cut by the sample boundary and rejects a bad tail', () => {
    const hindi = cutAtSample('अ', 1)
    const telugu = cutAtSample('అ', 2)
    const emoji = cutAtSample('😀', 3)
    expect(hindi.sample.length).toBe(MIME_SAMPLE_BYTES)
    expect(hindi.whole.length).toBeGreaterThan(MIME_SAMPLE_BYTES)
    expect(sameKind('text/plain', null, hindi.sample, true)).toBe(true)
    expect(sameKind('text/plain', null, telugu.sample, true)).toBe(true)
    expect(sameKind('text/plain', null, emoji.sample, true)).toBe(true)
    expect(sameKind('text/plain', null, hindi.sample, false)).toBe(false)
    expect(sameKind('text/plain', null, hindi.whole, false)).toBe(true)

    const invalid = (last: number[]) => {
      const sample = new Uint8Array(64)
      sample.fill(0x61)
      sample.set(last, sample.length - last.length)
      return sample
    }
    expect(sameKind('text/plain', null, invalid([0xff]), true)).toBe(false)
    expect(sameKind('text/plain', null, invalid([0xe0, 0x80]), true)).toBe(false)
    expect(sameKind('text/plain', null, invalid([0x80]), true)).toBe(false)
    expect(sameKind('text/plain', null, invalid([0xed, 0xa0]), true)).toBe(false)
    const nul = hindi.sample.slice()
    nul[10] = 0
    expect(sameKind('text/plain', null, nul, true)).toBe(false)
  })

  it('still treats other text types and audio containers as it did', () => {
    expect(sameKind('text/markdown', null, Uint8Array.from([0x00]))).toBe(true)
    expect(sameKind('audio/webm', 'video/webm', new Uint8Array())).toBe(true)
    expect(sameKind('audio/mp4', 'video/mp4', new Uint8Array())).toBe(true)
    expect(sameKind('audio/webm', 'audio/mpeg', new Uint8Array())).toBe(false)
    expect(sameKind('image/jpeg', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(true)
    expect(sameKind('image/png', 'image/jpeg', PNG)).toBe(false)
  })
})
