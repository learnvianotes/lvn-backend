import { defineConfig, env } from 'prisma/config'

// Same files the apps read: .env, then .env.local overrides it (ADR-0022). Real deployments set variables directly.
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    // file is optional
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
