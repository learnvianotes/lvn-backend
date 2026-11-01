/**
 * The AiModelRoute task admins set for the ID-card check (the same shape as ASK and EMBED).
 * An ID image is private: the route is used only when that connection may receive private data.
 */
export const ID_CARD_CHECK_TASK = 'ID_CARD_CHECK'

/** A connection and model that might read an ID card. */
export interface IdCardRouteTarget {
  /** null: the environment's provider */
  connectionId: string | null
  kind: string
  model: string
  mayReceivePrivate: boolean
}

/**
 * Which private provider should read an ID card when no route is set. Lower is preferred.
 * 0: Gemini Flash. 1: GPT-4o-mini. 2: any other private chat model.
 * Null when the provider must not receive the image.
 */
export function idCardPreference(candidate: { kind: string; model: string; mayReceivePrivate: boolean }): number | null {
  if (!candidate.mayReceivePrivate) return null
  const model = candidate.model.toLowerCase()
  const kind = candidate.kind.toLowerCase()
  if ((kind.includes('gemini') || model.includes('gemini')) && model.includes('flash')) return 0
  if (model.includes('gpt-4o-mini')) return 1
  return 2
}

/**
 * Who may read an ID card, best first.
 * When an admin has saved {@link ID_CARD_CHECK_TASK}, that model is the only candidate, and only if its connection
 * may receive private data. With no route: private Gemini Flash, then GPT-4o-mini, then any other private chat model.
 */
export function chooseIdCardTargets<T extends IdCardRouteTarget>(route: T | null, fallback: readonly T[]): T[] {
  if (route) return route.mayReceivePrivate ? [route] : []
  const ranked: { candidate: T; score: number }[] = []
  for (const candidate of fallback) {
    const score = idCardPreference(candidate)
    if (score !== null) ranked.push({ candidate, score })
  }
  ranked.sort((a, b) => a.score - b.score)
  const seen = new Set<string>()
  const out: T[] = []
  for (const { candidate } of ranked) {
    const key = `${candidate.connectionId ?? 'env'}:${candidate.model}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(candidate)
  }
  return out
}
