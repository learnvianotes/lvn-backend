import { generateKeyPairSync, randomBytes } from 'node:crypto'

/** A fresh RS256 key pair and code secret per test run — tests never use real secrets. */
export function testSecrets(): { JWT_PRIVATE_KEY: string; JWT_PUBLIC_KEY: string; CODE_HMAC_SECRET: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    JWT_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    CODE_HMAC_SECRET: randomBytes(32).toString('base64url'),
  }
}
