import { defineConfig, env } from 'prisma/config'

// Same files the apps read, .env.local overriding .env (ADR-0022). process.loadEnvFile never overwrites a variable
// that is already set, so the overriding file loads first. Real deployments set variables directly.
for (const file of ['.env.local', '.env']) {
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
