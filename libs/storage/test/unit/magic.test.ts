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

describe('plain text', () => {
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

  it('still treats other text types and audio containers as it did', () => {
    expect(sameKind('text/markdown', null, Uint8Array.from([0x00]))).toBe(true)
    expect(sameKind('audio/webm', 'video/webm', new Uint8Array())).toBe(true)
    expect(sameKind('audio/mp4', 'video/mp4', new Uint8Array())).toBe(true)
    expect(sameKind('audio/webm', 'audio/mpeg', new Uint8Array())).toBe(false)
    expect(sameKind('image/jpeg', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(true)
    expect(sameKind('image/png', 'image/jpeg', PNG)).toBe(false)
  })
})
