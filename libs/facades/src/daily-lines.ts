/**
 * Home's line for the day (ADR-0087): asked by `core` once a day for each person, written by `ai` through the gateway as
 * the platform's work, from a few facts about the person's learning.
 */
export const DAILY_LINES = Symbol('DAILY_LINES')

export interface DailyLines {
  /** Whether a line can be written now (AI on and answering); otherwise Home shows a chosen line. */
  available(): Promise<boolean>
  /** A headline of a few words and one sentence for `day` ("Wednesday 14 October"), from what is known of them. */
  write(input: { day: string; facts: string[] }): Promise<{ title: string; line: string }>
}
