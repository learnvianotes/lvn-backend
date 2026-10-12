import { writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startInfra, type TestInfra } from '@lvn-backend/testing'

declare global {
  var __LVN_INFRA__: TestInfra | undefined
}

/** Starts the containers once for the whole run; test files find them through LVN_TEST_INFRA. */
export default async function globalSetup(): Promise<void> {
  const infra = await startInfra()
  globalThis.__LVN_INFRA__ = infra
  const file = path.join(os.tmpdir(), `lvn-api-test-infra-${process.pid}.json`)
  writeFileSync(file, JSON.stringify({ databaseUrl: infra.databaseUrl, redisUrl: infra.redisUrl, s3: infra.s3, mail: infra.mail, typesense: infra.typesense }))
  process.env.LVN_TEST_INFRA = file
}
