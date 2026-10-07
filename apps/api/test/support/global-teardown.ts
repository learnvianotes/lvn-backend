import { rmSync } from 'node:fs'

export default async function globalTeardown(): Promise<void> {
  await globalThis.__LVN_INFRA__?.stop()
  if (process.env.LVN_TEST_INFRA) rmSync(process.env.LVN_TEST_INFRA, { force: true })
}
