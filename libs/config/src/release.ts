import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Root package name. Walking up from this file finds it in a checkout and in the image (`/app`). */
const ROOT_PACKAGE = 'lvn-backend'

/**
 * This build, `vX.Y.Z+<shortsha>` (VERSIONING.md). The version is the root `package.json`.
 * The short SHA is `RELEASE`, which deploy sets to the 12-character image tag. An unset `RELEASE`
 * is `dev`, the same stand-in traces already use.
 */
export function runningRelease(env: NodeJS.ProcessEnv = process.env): string {
  return formatRunningRelease(appVersion(), env.RELEASE)
}

/** `v` + the package version + `+` + {@link shortSha}. A leading `v` on the package version is dropped. */
export function formatRunningRelease(version: string, release: string | undefined): string {
  const clean = version.trim().replace(/^v/i, '')
  if (!/^\d+\.\d+\.\d+/.test(clean)) throw new Error(`root package.json version must look like 0.5.0, got ${JSON.stringify(version)}`)
  return `v${clean}+${shortSha(release)}`
}

/**
 * A hex commit SHA is cut to 12 characters, which is what `.github/workflows/deploy.yml` puts on the image
 * (`GITHUB_SHA::12`). Anything else (including `dev`) is kept as given. Missing is `dev`.
 */
export function shortSha(release: string | undefined): string {
  const value = (release ?? '').trim()
  if (!value || value.toLowerCase() === 'dev') return 'dev'
  if (/^[0-9a-f]{7,40}$/i.test(value)) return value.slice(0, 12).toLowerCase()
  return value
}

let cachedVersion: string | undefined

/** `version` from the root `package.json` (`lvn-backend`). */
export function appVersion(): string {
  if (cachedVersion) return cachedVersion
  cachedVersion = readRootVersion(__dirname)
  return cachedVersion
}

function readRootVersion(start: string): string {
  let dir = start
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string }
      if (pkg.name === ROOT_PACKAGE && typeof pkg.version === 'string' && pkg.version.length > 0) return pkg.version
    } catch {
      // Not this directory, or not JSON. Keep walking.
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not find the lvn-backend package.json version')
}
