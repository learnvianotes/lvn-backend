/**
 * The real type of a file from its first bytes (§7.2: uploads are validated by magic bytes, not extension). Only the
 * types LVN accepts are recognised; anything else is null.
 */
export function detectMimeType(b: Uint8Array): string | null {
  const at = (offset: number, ...bytes: number[]) => bytes.every((v, i) => b[offset + i] === v)
  const ascii = (offset: number, text: string) => at(offset, ...[...text].map((c) => c.charCodeAt(0)))
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif'
  if (ascii(0, '%PDF-')) return 'application/pdf'
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12))
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return 'image/heic'
    if (brand === 'M4A ') return 'audio/mp4'
    if (brand === 'qt  ') return 'video/quicktime'
    return 'video/mp4'
  }
  if (ascii(0, 'OggS')) return 'audio/ogg'
  if (ascii(0, 'ID3') || at(0, 0xff, 0xfb) || at(0, 0xff, 0xf3) || at(0, 0xff, 0xf2)) return 'audio/mpeg'
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'audio/wav'
  return null
}
