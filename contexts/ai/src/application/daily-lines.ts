import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import type { DailyLines } from '@lvn-backend/facades'
import { AiGateway } from './ai-gateway'

export const dailyLineSchema = z.object({ title: z.string().min(2).max(80), line: z.string().min(8).max(300) })

/** What the model wrote, made to fit the card: no quotes or emoji, at most six words and 160 characters. */
export function cleanLine(o: z.infer<typeof dailyLineSchema>): { title: string; line: string } {
  const tidy = (s: string) => s.replace(/\p{Extended_Pictographic}|️/gu, '').replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '').replace(/\s+/g, ' ').trim()
  const title = tidy(o.title).replace(/[.!]+$/, '').split(' ').slice(0, 6).join(' ')
  let line = tidy(o.line)
  if (line.length > 160) line = `${line.slice(0, 157).replace(/\s+\S*$/, '')}…`
  return { title, line }
}

/**
 * The DAILY_LINES facade (ADR-0087): Home's headline and sentence for one person's day, as the platform's work. The facts
 * are the person's own learning, so only a provider that may receive private data writes it.
 */
@Injectable()
export class AiDailyLines implements DailyLines {
  constructor(private readonly gateway: AiGateway) {}

  async available(): Promise<boolean> {
    return (await this.gateway.status()).available
  }

  async write(input: { day: string; facts: string[] }): Promise<{ title: string; line: string }> {
    const facts = input.facts.length ? input.facts.map((f) => `- ${f}`).join('\n') : '- Nothing learned in the app yet: a fresh start.'
    const out = await this.gateway.generate({ task: 'DAILY_LINE', userId: null, private: true, prompt: 'daily-line', vars: { day: input.day }, content: { facts }, schema: dailyLineSchema, temperature: 0.9 })
    return cleanLine(out.output)
  }
}
