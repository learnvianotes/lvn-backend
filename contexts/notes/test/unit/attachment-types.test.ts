import { UploadLimits } from '@lvn/contracts/domain'
import { FilesService } from '../../src/application/files.service'

function files() {
  return new FilesService(
    {} as never,
    {} as never,
    { hit: async () => ({ allowed: true, retryAfter: 0 }), charge: async () => ({ allowed: true, retryAfter: 0 }) } as never,
    {} as never,
    { actor: async () => ({ id: 'child', restrictedMinor: true }) } as never,
    { limit: async () => { throw new Error('past-gate') } } as never,
    {} as never,
    { uploads: true, scan: { mode: 'off' }, uploadLimits: { perMinute: 10, perDay: 10, bytesPerDay: 10, pendingScans: 10 } } as never,
    { boolean: () => true, integer: (_key: string, fallback: number) => fallback } as never,
    { assertCaptureAllowed: async () => undefined } as never,
  )
}

const OFFICE = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]

describe('note attachment types', () => {
  const mb = Math.round(UploadLimits.document / 1024 ** 2)

  it('accepts Word, PowerPoint and plain text up to the PDF limit', async () => {
    const service = files()
    for (const mimeType of OFFICE) {
      await expect(service.createUploadIntent('child', { purpose: 'ATTACHMENT', mimeType, fileName: 'notes', sizeBytes: UploadLimits.document })).rejects.toThrow(/which note/)
    }
    await expect(service.createUploadIntent('child', {
      purpose: 'ATTACHMENT',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'big.docx',
      sizeBytes: UploadLimits.document + 1,
    })).rejects.toThrow(new RegExp(`${mb} MB`))
  })

  it('does not take HEIC as a note attachment', async () => {
    const service = files()
    await expect(service.createUploadIntent('child', { purpose: 'ATTACHMENT', mimeType: 'image/heic', fileName: 'photo.heic', sizeBytes: 1000 })).rejects.toThrow(/not accepted/)
  })
})
