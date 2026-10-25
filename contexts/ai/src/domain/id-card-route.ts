/**
 * Which private provider should read an ID card. Lower is preferred.
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
