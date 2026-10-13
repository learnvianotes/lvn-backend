import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { AI_CONFIG, type AiConfig } from '../ai.config'

/**
 * Provider keys at rest (ADR-0065): AES-256-GCM under a key derived from AI_KEYS_SECRET, stored as
 * `iv.tag.ciphertext` in base64url. Without the secret no key can be saved or read, and connections that need one
 * do not answer.
 */
@Injectable()
export class AiKeys {
  private readonly key: Buffer | null

  constructor(@Inject(AI_CONFIG) config: AiConfig) {
    this.key = config.keysSecret ? createHash('sha256').update(`lvn-ai-keys:${config.keysSecret}`).digest() : null
  }

  get available(): boolean {
    return this.key !== null
  }

  seal(plain: string): string {
    if (!this.key) throw new Error('AI_KEYS_SECRET is not set')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
  }

  /** The key, or null when there is no secret or the secret changed since it was saved. */
  open(sealed: string): string | null {
    if (!this.key) return null
    try {
      const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv!)
      decipher.setAuthTag(tag!)
      return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8')
    } catch {
      return null
    }
  }
}
