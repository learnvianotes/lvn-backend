import { HttpProviderError, ProviderError } from '../domain/provider'

/**
 * An HTTP call to a provider: a timeout or network failure and 5xx/429 answers are worth another try; other 4xx answers
 * (an unknown model, a bad key, a bad request) are not. The provider's own words come back in the error.
 */
export async function callProvider(label: string, url: string, headers: Record<string, string>, body: object, timeoutMs: number, method: 'POST' | 'GET' = 'POST'): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) })
  } catch (e) {
    const timeout = (e as Error).name === 'TimeoutError'
    throw new ProviderError(`${label}: ${timeout ? `no answer in ${timeoutMs} ms` : (e as Error).message}`, true)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new HttpProviderError(`${label}: ${res.status} ${text.slice(0, 300)}`, res.status >= 500 || res.status === 429, res.status, text)
  }
  return res
}

/** Server-sent events: each `data:` payload as it arrives (OpenAI's and Anthropic's streams). */
export async function* serverSentEvents(res: Response): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true })
    let end: number
    while ((end = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '')
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) yield data
    }
  }
}
