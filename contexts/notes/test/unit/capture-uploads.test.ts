import { ErrorCode, Errors } from '@lvn-backend/errors'
import { FilesService } from '../../src/application/files.service'

function files(assertCaptureAllowed: jest.Mock) {
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
    { assertCaptureAllowed } as never,
  )
}

describe('camera, microphone, audio and video uploads', () => {
  it('refuses a voice note for an under-13 account until consent is verified', async () => {
    const assertCaptureAllowed = jest.fn(async () => Promise.reject(Errors.minorFeature('This isn’t available on this account yet.')))
    const service = files(assertCaptureAllowed)
    await expect(service.createUploadIntent('child', { purpose: 'VOICE_NOTE', mimeType: 'audio/webm', fileName: 'note.webm', sizeBytes: 1000 })).rejects.toMatchObject({ code: ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR })
    expect(assertCaptureAllowed).toHaveBeenCalledWith('child', 'VOICE_NOTE', 'audio/webm')
  })

  it('lets a still image and a verified voice note continue past the capture gate', async () => {
    const assertCaptureAllowed = jest.fn(async () => undefined)
    const service = files(assertCaptureAllowed)
    await expect(service.createUploadIntent('child', { purpose: 'ATTACHMENT', mimeType: 'image/jpeg', fileName: 'photo.jpg', sizeBytes: 1000 })).rejects.toThrow(/which note/)
    await expect(service.createUploadIntent('child', { purpose: 'VOICE_NOTE', mimeType: 'audio/webm', fileName: 'note.webm', sizeBytes: 1000 })).rejects.toThrow(/past-gate/)
    expect(assertCaptureAllowed).toHaveBeenNthCalledWith(1, 'child', 'ATTACHMENT', 'image/jpeg')
    expect(assertCaptureAllowed).toHaveBeenNthCalledWith(2, 'child', 'VOICE_NOTE', 'audio/webm')
  })
})
