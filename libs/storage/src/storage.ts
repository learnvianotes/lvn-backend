import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Global, Module, type DynamicModule } from '@nestjs/common'

export interface StorageConfig {
  /** Set for S3-compatible servers (RustFS locally, ADR-0032); unset on AWS */
  endpoint?: string
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  forcePathStyle: boolean
}

export interface ObjectInfo {
  sizeBytes: number
  contentType: string | null
}

/**
 * Object storage (§8): bytes only — every object's metadata of record is its FileObject row. Business-free: callers
 * decide buckets, keys and who may get a URL.
 */
export class Storage {
  readonly client: S3Client

  constructor(config: StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      ...(config.accessKeyId && config.secretAccessKey ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } } : {}),
    })
  }

  /** A pre-signed PUT bound to the declared type and size: the client cannot upload anything else with it. */
  async presignPut(bucket: string, key: string, opts: { contentType: string; sizeBytes: number; expiresInSeconds: number; metadata?: Record<string, string> }) {
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: opts.contentType, ContentLength: opts.sizeBytes, Metadata: opts.metadata })
    const url = await getSignedUrl(this.client, command, {
      expiresIn: opts.expiresInSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
      unhoistableHeaders: opts.metadata ? new Set(Object.keys(opts.metadata).map((k) => `x-amz-meta-${k}`)) : undefined,
    })
    const headers: Record<string, string> = { 'content-type': opts.contentType }
    for (const [k, v] of Object.entries(opts.metadata ?? {})) headers[`x-amz-meta-${k}`] = v
    return { url, headers, expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000) }
  }

  /** A short-lived GET; `downloadName` sets Content-Disposition so the original name is never in the key. */
  async presignGet(bucket: string, key: string, opts: { expiresInSeconds: number; downloadName?: string }) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(opts.downloadName ? { ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}` } : {}),
    })
    return { url: await getSignedUrl(this.client, command, { expiresIn: opts.expiresInSeconds }), expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000) }
  }

  /** Size and type of an object, or null if it does not exist. */
  async head(bucket: string, key: string): Promise<ObjectInfo | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return { sizeBytes: r.ContentLength ?? 0, contentType: r.ContentType ?? null }
    } catch (e) {
      if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null
      throw e
    }
  }

  /** Writes an object the server made itself (exports, files from imports); browsers use presignPut. */
  async put(bucket: string, key: string, body: Uint8Array, opts: { contentType: string; metadata?: Record<string, string> }): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: opts.contentType, Metadata: opts.metadata }))
  }

  /** A whole object, refused when it is larger than `maxBytes` (imports read uploads this way). */
  async getBytes(bucket: string, key: string, maxBytes: number): Promise<Uint8Array> {
    const info = await this.head(bucket, key)
    if (!info) throw new Error(`No object ${key}`)
    if (info.sizeBytes > maxBytes) throw new Error(`Object ${key} is larger than ${maxBytes} bytes`)
    const r = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array()
  }

  /** The first `bytes` bytes of an object (magic-byte checks, §7.2). */
  async firstBytes(bucket: string, key: string, bytes = 64): Promise<Uint8Array> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` }))
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array()
  }

  /** An object streamed to a file (media processing reads large files this way). */
  async download(bucket: string, key: string, path: string): Promise<void> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!r.Body) throw new Error(`No object ${key}`)
    await pipeline(r.Body as Readable, createWriteStream(path))
  }

  /** A file streamed to an object (variants the server made). */
  async putFile(bucket: string, key: string, path: string, opts: { contentType: string }): Promise<void> {
    const { size } = await stat(path)
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: opts.contentType }))
  }

  async copy(from: { bucket: string; key: string }, to: { bucket: string; key: string }): Promise<void> {
    await this.client.send(new CopyObjectCommand({ CopySource: `${from.bucket}/${encodeURIComponent(from.key).replace(/%2F/g, '/')}`, Bucket: to.bucket, Key: to.key }))
  }

  /** Every key under a prefix, a page at a time (reconciliation). */
  async *list(bucket: string, prefix: string, pageSize = 1000): AsyncGenerator<string> {
    let token: string | undefined
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: pageSize }))
      for (const o of page.Contents ?? []) if (o.Key) yield o.Key
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
  }

  async delete(bucket: string, keys: string[]): Promise<void> {
    if (!keys.length) return
    await this.client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }))
  }

  /** Development and tests: create buckets that do not exist yet. Sandbox and production buckets come from Terraform. */
  async ensureBuckets(buckets: string[]): Promise<void> {
    for (const Bucket of buckets) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket }))
      } catch {
        await this.client.send(new CreateBucketCommand({ Bucket }))
      }
    }
  }
}

/** Registered once by each composition root. */
@Global()
@Module({})
export class StorageModule {
  static forRoot(config: StorageConfig): DynamicModule {
    return { module: StorageModule, providers: [{ provide: Storage, useValue: new Storage(config) }], exports: [Storage] }
  }
}
