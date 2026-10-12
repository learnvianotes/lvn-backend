/** Reads what the API sent through Mailpit (tests only). */
export interface SentMail {
  id: string
  to: string[]
  subject: string
  text: string
  html: string
}

interface MailpitSummary { ID: string; To: { Address: string }[]; Subject: string; Created: string }

export class Mailbox {
  constructor(private readonly apiUrl: string) {}

  async clear(): Promise<void> {
    await fetch(`${this.apiUrl}/api/v1/messages`, { method: 'DELETE' })
  }

  /** The newest message to `address`, waiting up to `timeoutMs` for it to arrive. */
  async latestTo(address: string, timeoutMs = 5000): Promise<SentMail> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const res = await fetch(`${this.apiUrl}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)
      const { messages } = (await res.json()) as { messages: MailpitSummary[] }
      const latest = messages[0]
      if (latest) {
        const full = (await (await fetch(`${this.apiUrl}/api/v1/message/${latest.ID}`)).json()) as { Text: string; HTML: string; Subject: string; To: { Address: string }[] }
        return { id: latest.ID, to: full.To.map((t) => t.Address), subject: full.Subject, text: full.Text, html: full.HTML }
      }
      if (Date.now() > deadline) throw new Error(`No email to ${address} within ${timeoutMs} ms`)
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  /** A message's headers, each name with its values (Mailpit's own view). */
  async headers(id: string): Promise<Record<string, string[]>> {
    return (await (await fetch(`${this.apiUrl}/api/v1/message/${id}/headers`)).json()) as Record<string, string[]>
  }

  async countTo(address: string): Promise<number> {
    const res = await fetch(`${this.apiUrl}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)
    return ((await res.json()) as { messages_count: number }).messages_count
  }
}
