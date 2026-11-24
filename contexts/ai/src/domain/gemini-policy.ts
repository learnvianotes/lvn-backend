/** A Gemini model id (`gemini-2.5-flash`, `models/gemini-2.5-flash`). Gemma is not Gemini. */
export function isGeminiModel(id: string | null | undefined): boolean {
  if (!id) return false
  let name = id.trim().toLowerCase().replace(/^models\//, '')
  const slash = name.lastIndexOf('/')
  if (slash >= 0) name = name.slice(slash + 1)
  return /^gemini($|-)/.test(name)
}

/** Google's Generative Language API, including the OpenAI-compatible base URL Gemini documents. */
export function isGoogleGenerativeUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const host = hostname(url)
  return host === 'generativelanguage.googleapis.com' || host.endsWith('.generativelanguage.googleapis.com')
}

/** OpenAI's own API host. A compatible proxy on any other host is not treated as OpenAI. */
export function isOpenAiApiUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const host = hostname(url)
  return host === 'api.openai.com' || host.endsWith('.openai.azure.com') || host.endsWith('.api.openai.com')
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Env vars that mean a Gemini or Google Generative AI key is configured. Firebase and public client keys are not these. */
const GEMINI_ENV = /(^|_)GEMINI($|_)|GENERATIVE_AI|GOOGLE_GENAI|(^|_)GENAI($|_)|^GOOGLE_API_KEY$/

/**
 * Names of environment variables that configure Gemini or Google Generative AI. Values are never returned.
 * `NEXT_PUBLIC_` and `EXPO_PUBLIC_` client keys, and anything with FIREBASE in the name, are ignored.
 */
export function geminiEnvNames(env: NodeJS.ProcessEnv): string[] {
  return Object.keys(env)
    .filter((name) => {
      if (!env[name]) return false
      if (name.startsWith('NEXT_PUBLIC_') || name.startsWith('EXPO_PUBLIC_')) return false
      if (name.includes('FIREBASE')) return false
      return GEMINI_ENV.test(name)
    })
    .sort()
}

export interface GeminiConnectionSignal {
  label: string
  kind: string
  enabled: boolean
  baseUrl: string | null
  chatModel: string | null
  embedModel: string | null
  hasKey: boolean
}

export interface GeminiRouteSignal {
  task: string
  model: string
  connectionKind: string | null
}

/** Why production must refuse to start. Empty when nothing points at Gemini or Google Generative AI. */
export function geminiFindings(input: {
  envNames: readonly string[]
  connections: readonly GeminiConnectionSignal[]
  routes: readonly GeminiRouteSignal[]
  chatModel: string | null
  embedModel: string | null
}): string[] {
  const found: string[] = []
  for (const name of input.envNames) found.push(`environment variable ${name} is set`)
  for (const row of input.connections) {
    if (row.kind === 'GEMINI') found.push(`connection "${row.label}" is a Gemini connection${row.enabled ? ' and it is enabled' : ''}${row.hasKey ? ' with a key saved' : ''}`)
    else if (isGoogleGenerativeUrl(row.baseUrl)) found.push(`connection "${row.label}" uses a Google Generative AI address`)
    if (row.kind !== 'GEMINI' && (isGeminiModel(row.chatModel) || isGeminiModel(row.embedModel))) found.push(`connection "${row.label}" names a Gemini model`)
  }
  for (const route of input.routes) {
    if (route.connectionKind === 'GEMINI' || isGeminiModel(route.model)) found.push(`route ${route.task} uses Gemini`)
  }
  if (isGeminiModel(input.chatModel)) found.push('AI_CHAT_MODEL is a Gemini model')
  if (isGeminiModel(input.embedModel)) found.push('AI_EMBED_MODEL is a Gemini model')
  return found
}

/** Production throws. Every other environment only reports the same sentences for a warning. */
export function geminiStartupDecision(appEnv: string, findings: readonly string[]): { refuse: boolean; message: string } | null {
  if (!findings.length) return null
  const message = `Gemini and Google Generative AI are not allowed. ${findings.join('; ')}. Remove them before production will start.`
  return { refuse: appEnv === 'production', message }
}
