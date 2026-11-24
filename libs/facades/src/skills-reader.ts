/**
 * A teacher's public page or profile read into Skills tab items (ADR-0077): asked by `users` while it imports from a
 * proven identifier, answered by `ai` through the gateway as the platform's work.
 */
export const SKILLS_READER = Symbol('SKILLS_READER')

export interface ReadSkill {
  kind: 'SKILL' | 'QUALIFICATION' | 'EXPERIENCE' | 'PUBLICATION'
  name: string
  detail: string | null
}

export interface SkillsReader {
  /** Whether text can be read now (AI on and answering); otherwise only what needs no AI is imported. */
  available(): Promise<boolean>
  /** What the text says, at most 30 items, for the teacher to review. `subjectId` is that teacher. */
  read(source: 'a GitHub profile' | 'a personal or faculty page', text: string, subjectId?: string | null): Promise<ReadSkill[]>
}
