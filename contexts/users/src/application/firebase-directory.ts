import { Logger } from '@nestjs/common'
import { initializeApp, type App } from 'firebase-admin/app'

/**
 * Firebase records a minor purge must remove (ADR-0110): the Auth user (Google sign-in uid), an FCM registration
 * token, and a Firebase installation id. Connection details stay in the environment (FIREBASE_PROJECT_ID and the
 * existing application credentials). A missing project or credential is `unconfigured` and does not throw, so the
 * local rows can still be deleted. A user or token Google no longer has is `absent`. Anything else is thrown so
 * the purge can be retried.
 */
export const FIREBASE_DIRECTORY = Symbol('FIREBASE_DIRECTORY')

export type FirebaseDeleteResult = 'deleted' | 'absent' | 'unconfigured'

export interface FirebaseDirectory {
  deleteAuthUser(uid: string): Promise<FirebaseDeleteResult>
  /** Unregisters an FCM token at Google (Instance ID). The caller deletes the local row after a non-throwing result. */
  deleteRegistration(token: string): Promise<FirebaseDeleteResult>
  deleteInstallation(fid: string): Promise<FirebaseDeleteResult>
}

export class FirebaseAdminDirectory implements FirebaseDirectory {
  private readonly log = new Logger('FirebaseDirectory')
  private app: App | null = null
  private unavailable = false

  constructor(private readonly projectId: string | undefined) {}

  async deleteAuthUser(uid: string): Promise<FirebaseDeleteResult> {
    const auth = await this.auth()
    if (!auth) return 'unconfigured'
    try {
      await auth.deleteUser(uid)
      return 'deleted'
    } catch (err) {
      if (codeOf(err) === 'auth/user-not-found') return 'absent'
      if (unconfigured(err)) return this.giveUp(err)
      throw err
    }
  }

  async deleteRegistration(token: string): Promise<FirebaseDeleteResult> {
    return this.httpDelete(`https://iid.googleapis.com/iid/v1/${encodeURIComponent(token)}`)
  }

  async deleteInstallation(fid: string): Promise<FirebaseDeleteResult> {
    if (!this.projectId) return 'unconfigured'
    return this.httpDelete(`https://firebaseinstallations.googleapis.com/v1/projects/${this.projectId}/installations/${encodeURIComponent(fid)}`)
  }

  private async httpDelete(url: string): Promise<FirebaseDeleteResult> {
    const accessToken = await this.accessToken()
    if (!accessToken) return 'unconfigured'
    const res = await fetch(url, { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) })
    if (res.ok || res.status === 204) return 'deleted'
    if (res.status === 404) return 'absent'
    // The installations API often wants the client's own token, which we do not keep. A refusal is terminal.
    if (res.status === 401 || res.status === 403) return 'unconfigured'
    throw new Error(`Firebase delete answered HTTP ${res.status}`)
  }

  private async auth(): Promise<{ deleteUser(uid: string): Promise<void> } | null> {
    const app = await this.ready()
    if (!app) return null
    const { getAuth } = await import('firebase-admin/auth')
    return getAuth(app)
  }

  private async accessToken(): Promise<string | null> {
    const app = await this.ready()
    const credential = app?.options.credential
    if (!credential) return null
    try {
      return (await credential.getAccessToken()).access_token
    } catch (err) {
      if (unconfigured(err)) return this.giveUp(err) === 'unconfigured' ? null : null
      throw err
    }
  }

  private async ready(): Promise<App | null> {
    if (this.unavailable || !this.projectId) return null
    if (this.app) return this.app
    try {
      const { applicationDefault, getApp } = await import('firebase-admin/app')
      const name = `lvn-purge-${this.projectId}`
      try {
        this.app = getApp(name)
      } catch {
        this.app = initializeApp({ credential: applicationDefault(), projectId: this.projectId }, name)
      }
      return this.app
    } catch (err) {
      this.giveUp(err)
      return null
    }
  }

  /** One warning, with the error name only. Later calls in this process do not try again. */
  private giveUp(err: unknown): 'unconfigured' {
    this.unavailable = true
    this.log.warn(`Firebase directory is not configured (${codeOf(err)})`)
    return 'unconfigured'
  }
}

function codeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code)
  return err instanceof Error ? err.name : 'unknown'
}

function unconfigured(err: unknown): boolean {
  const code = codeOf(err)
  return code === 'app/invalid-credential' || code === 'auth/invalid-credential' || /credential|ENOTFOUND/i.test(code)
}
