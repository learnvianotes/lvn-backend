#!/usr/bin/env node
/**
 * Development secrets: an RS256 key pair for access tokens and the code HMAC secret, written to .env.local
 * (git-ignored). Sandbox and production read theirs from AWS Secrets Manager (§7.2). Existing values are kept unless
 * --force is given, so running it twice does not sign everyone out.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const file = '.env.local'
const force = process.argv.includes('--force')
let text = existsSync(file) ? readFileSync(file, 'utf8') : ''
const has = (name) => new RegExp(`^${name}=`, 'm').test(text)
const set = (name, value) => {
  const line = `${name}=${value}`
  text = has(name) ? text.replace(new RegExp(`^${name}=.*$`, 'm'), line) : `${text.replace(/\n?$/, '\n')}${line}\n`
}
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n')

if (force || !has('JWT_PRIVATE_KEY') || !has('JWT_PUBLIC_KEY')) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  set('JWT_PRIVATE_KEY', oneLine(privateKey.export({ type: 'pkcs8', format: 'pem' })))
  set('JWT_PUBLIC_KEY', oneLine(publicKey.export({ type: 'spki', format: 'pem' })))
  console.log('JWT key pair written to .env.local')
}
if (force || !has('CODE_HMAC_SECRET')) {
  set('CODE_HMAC_SECRET', randomBytes(32).toString('base64url'))
  console.log('CODE_HMAC_SECRET written to .env.local')
}
writeFileSync(file, text)
