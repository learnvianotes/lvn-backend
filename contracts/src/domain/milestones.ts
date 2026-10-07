/**
 * Public counts are shown only as milestones (ADR-0027): nothing below the first rung, then the highest rung reached
 * ("1,000+ learners"). The exact number never leaves the backend.
 */
export const MILESTONES = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000] as const

/** The highest milestone at or below `count`, or null below the first one. Above the ladder, whole millions. */
export function milestoneFor(count: number): number | null {
  if (!Number.isFinite(count) || count < MILESTONES[0]) return null
  const top = Math.max(...MILESTONES)
  if (count >= top) return Math.floor(count / top) * top
  let reached: number = MILESTONES[0]
  for (const m of MILESTONES) if (count >= m) reached = m
  return reached
}
