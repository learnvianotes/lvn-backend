import { startS3 } from '@lvn-backend/testing'
import { detectMimeType } from '../../src/magic'
import { Storage } from '../../src/storage'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])

describe('Storage against an S3-compatible server', () => {
  let storage: Storage
  let stop: () => Promise<unknown>

  beforeAll(async () => {
    const s3 = await startS3()
    stop = () => s3.container.stop()
    storage = new Storage({ endpoint: s3.endpoint, region: 'us-east-1', accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, forcePathStyle: true })
    await storage.ensureBuckets(['lvn-files'])
  })

  afterAll(() => stop())

  it('uploads through a pre-signed PUT, then heads, reads, signs a GET and deletes', async () => {
    const put = await storage.presignPut('lvn-files', 'test/u1/f1/original', { contentType: 'image/png', sizeBytes: PNG.length, expiresInSeconds: 600, metadata: { 'file-id': 'f1' } })
    const res = await fetch(put.url, { method: 'PUT', headers: put.headers, body: PNG })
    expect(res.status).toBe(200)
    expect(await storage.head('lvn-files', 'test/u1/f1/original')).toEqual({ sizeBytes: PNG.length, contentType: 'image/png' })
    expect(detectMimeType(await storage.firstBytes('lvn-files', 'test/u1/f1/original'))).toBe('image/png')
    const get = await storage.presignGet('lvn-files', 'test/u1/f1/original', { expiresInSeconds: 60, downloadName: 'my photo.png' })
    const body = new Uint8Array(await (await fetch(get.url)).arrayBuffer())
    expect(body).toEqual(PNG)
    await storage.delete('lvn-files', ['test/u1/f1/original'])
    expect(await storage.head('lvn-files', 'test/u1/f1/original')).toBeNull()
  })

  it('refuses an upload of another size than signed', async () => {
    const put = await storage.presignPut('lvn-files', 'test/u1/f2/original', { contentType: 'image/png', sizeBytes: 4, expiresInSeconds: 600 })
    const res = await fetch(put.url, { method: 'PUT', headers: put.headers, body: PNG })
    expect(res.ok).toBe(false)
  })

  it('refuses an upload of another type than signed', async () => {
    const put = await storage.presignPut('lvn-files', 'test/u1/f3/original', { contentType: 'image/png', sizeBytes: PNG.length, expiresInSeconds: 600 })
    const res = await fetch(put.url, { method: 'PUT', headers: { 'content-type': 'text/html' }, body: PNG })
    expect(res.ok).toBe(false)
  })
})

describe('detectMimeType', () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    [[...PNG], 'image/png'],
    [[...Buffer.from('%PDF-1.7')], 'application/pdf'],
    [[...Buffer.from('RIFF\0\0\0\0WEBPVP8 ')], 'image/webp'],
    [[...Buffer.from('<html><script>')], null],
    [[0x4d, 0x5a, 0x90, 0x00], null],
  ])('%j is %s', (bytes, type) => {
    expect(detectMimeType(Uint8Array.from(bytes as number[]))).toBe(type)
  })
})
