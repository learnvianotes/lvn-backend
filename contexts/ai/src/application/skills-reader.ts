import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import type { ReadSkill, SkillsReader } from '@lvn-backend/facades'
import { AiGateway } from './ai-gateway'

const item = z.object({
  kind: z.enum(['SKILL', 'QUALIFICATION', 'EXPERIENCE', 'PUBLICATION']),
  name: z.string(),
  detail: z.string().nullable().optional(),
})
export const skillsSchema = z.object({ items: z.array(item).max(60) })

/** What the model listed, trimmed to the Skills tab's limits, empty names and repeats left out (ADR-0077). */
export function cleanSkills(items: z.infer<typeof item>[]): ReadSkill[] {
  const seen = new Set<string>()
  const out: ReadSkill[] = []
  for (const i of items) {
    const name = i.name.replace(/\s+/g, ' ').trim().slice(0, 120)
    const key = `${i.kind}:${name.toLowerCase()}`
    if (!name || seen.has(key)) continue
    seen.add(key)
    const detail = i.detail?.replace(/\s+/g, ' ').trim().slice(0, 500) || null
    out.push({ kind: i.kind, name, detail })
    if (out.length === 30) break
  }
  return out
}

/**
 * The SKILLS_READER facade (ADR-0077): a teacher's public page or profile read into Skills tab items, as the platform's
 * work. The text is public and fenced as content; what comes back is a draft the teacher reviews.
 */
@Injectable()
export class AiSkillsReader implements SkillsReader {
  constructor(private readonly gateway: AiGateway) {}

  async available(): Promise<boolean> {
    return (await this.gateway.status()).available
  }

  async read(source: 'a GitHub profile' | 'a personal or faculty page', text: string): Promise<ReadSkill[]> {
    const out = await this.gateway.generate({ task: 'READ_SKILLS', userId: null, private: false, prompt: 'read-skills', vars: { source }, content: { text }, schema: skillsSchema, temperature: 0 })
    return cleanSkills(out.output.items)
  }
}
