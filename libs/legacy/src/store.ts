import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { Storage } from '@lvn-backend/storage'
import { legacyIndex, legacyUserSnapshot, type LegacyIndex, type LegacyUserSnapshot } from './format'

/**
 * Where snapshots live: the restricted bucket (own key, never behind the CDN), `{env}/legacy/index.json` and
 * `{env}/legacy/users/{uid}.json`. Deleted 12 months after cut-over when declined or never claimed (ADR-0023).
 */
export class LegacySnapshots {
  constructor(
    private readonly storage: Storage,
    private readonly bucket: string,
    private readonly env: string,
  ) {}

  indexKey = (): string => `${this.env}/legacy/index.json`
  userKey = (uid: string): string => `${this.env}/legacy/users/${encodeURIComponent(uid)}.json`

  async readIndex(): Promise<LegacyIndex | null> {
    const raw = await this.read(this.indexKey())
    return raw === null ? null : legacyIndex.parse(raw)
  }

  async readUser(uid: string): Promise<LegacyUserSnapshot | null> {
    const raw = await this.read(this.userKey(uid))
    return raw === null ? null : legacyUserSnapshot.parse(raw)
  }

  async writeIndex(index: LegacyIndex): Promise<void> {
    await this.write(this.indexKey(), legacyIndex.parse(index))
  }

  async writeUser(snapshot: LegacyUserSnapshot): Promise<void> {
    await this.write(this.userKey(snapshot.uid), legacyUserSnapshot.parse(snapshot))
  }

  /** Raw old-site events, one JSON object per line, kept 24 months for history (§15.2 retention). */
  async writeEvents(uid: string, lines: string[]): Promise<void> {
    if (!lines.length) return
    await this.storage.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: `${this.env}/legacy/events/${encodeURIComponent(uid)}.jsonl`, Body: `${lines.join('\n')}\n`, ContentType: 'application/x-ndjson' }),
    )
  }

  async deleteUser(uid: string): Promise<void> {
    await this.storage.delete(this.bucket, [this.userKey(uid)])
  }

  private async read(key: string): Promise<unknown | null> {
    try {
      const r = await this.storage.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      return JSON.parse(await r.Body!.transformToString())
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      if (status === 404 || (e as { name?: string }).name === 'NoSuchKey') return null
      throw e
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    await this.storage.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: JSON.stringify(value), ContentType: 'application/json' }))
  }
}
