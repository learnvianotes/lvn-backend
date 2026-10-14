/**
 * Points, contributor levels and achievements (ADR-0080): the rules, as data and pure functions.
 */

export type PointsRuleName = 'REACTION' | 'FORK' | 'RESOURCE_APPROVED'
export type AchievementKindName = 'TOPICS_MASTERED' | 'QUIZ_MASTER' | 'EXAM_READY' | 'RHYTHM_WEEKS' | 'SUBJECT_CONTRIBUTOR'
export type ContributorLevelName = 'NEWCOMER' | 'CONTRIBUTOR' | 'TRUSTED'

/** What each of other people's actions on someone's public work is worth */
export const POINTS: Record<PointsRuleName, number> = { REACTION: 1, FORK: 5, RESOURCE_APPROVED: 10 }

export const POINTS_LIMITS = {
  /** An actor's account is at least this old to count */
  actorMinAgeDays: 7,
  /** The same actor counts at most this many times towards the same person … */
  perPairPerWeek: 5,
  /** … within these days */
  pairWindowDays: 7,
  /** Reactions earn a person at most this many points a day (UTC) */
  reactionsPerDay: 50,
} as const

/** Levels by points, lowest first; a level is lost when points fall below it */
export const LEVELS: readonly { level: ContributorLevelName; from: number }[] = [
  { level: 'NEWCOMER', from: 0 },
  { level: 'CONTRIBUTOR', from: 50 },
  { level: 'TRUSTED', from: 250 },
]

/** A trusted contributor may submit this many resources a day (others: RESOURCE_LIMITS.perDay) */
export const TRUSTED_RESOURCES_PER_DAY = 20

export function levelOf(points: number): { level: ContributorLevelName; nextAt: number | null } {
  let at = 0
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]!.from) at = i
  return { level: LEVELS[at]!.level, nextAt: LEVELS[at + 1]?.from ?? null }
}

/** The tiers of each achievement, lowest first */
export const TIERS: Record<AchievementKindName, readonly number[]> = {
  TOPICS_MASTERED: [1, 5, 20, 50],
  QUIZ_MASTER: [1, 5],
  EXAM_READY: [1, 5],
  RHYTHM_WEEKS: [4, 12, 26, 52],
  SUBJECT_CONTRIBUTOR: [50, 250],
}

/** A topic is mastered at this mastery (as Readiness counts it) … */
export const MASTERED_AT = 0.8
/** … with at least this many studied cards or quiz answers on it */
export const MASTERY_MIN_CARDS = 5
export const MASTERY_MIN_ANSWERS = 10
/** Quiz master: at least this many answers on a topic, at least this share correct */
export const QUIZ_MASTER_MIN_ANSWERS = 30
export const QUIZ_MASTER_ACCURACY = 0.9

/** What a person's achievements are computed from */
export interface AchievementFacts {
  topicsMastered: number
  quizMasterTopics: number
  examsReady: number
  rhythmWeeksMet: number
  /** Points from notes on each subject */
  subjectPoints: { subjectId: string; title: string; points: number }[]
}

export interface Earned {
  kind: AchievementKindName
  tier: number
  subjectId: string | null
  subjectTitle: string | null
  /** Unique per person: what makes each tier awarded once */
  key: string
}

/** Every tier the facts reach (already awarded ones included: the caller keeps the new ones). */
export function achievementsFrom(f: AchievementFacts): Earned[] {
  const out: Earned[] = []
  const reach = (kind: AchievementKindName, value: number) => {
    for (const tier of TIERS[kind]) if (value >= tier) out.push({ kind, tier, subjectId: null, subjectTitle: null, key: `${kind}:${tier}` })
  }
  reach('TOPICS_MASTERED', f.topicsMastered)
  reach('QUIZ_MASTER', f.quizMasterTopics)
  reach('EXAM_READY', f.examsReady)
  reach('RHYTHM_WEEKS', f.rhythmWeeksMet)
  for (const s of f.subjectPoints)
    for (const tier of TIERS.SUBJECT_CONTRIBUTOR) if (s.points >= tier) out.push({ kind: 'SUBJECT_CONTRIBUTOR', tier, subjectId: s.subjectId, subjectTitle: s.title, key: `SUBJECT_CONTRIBUTOR:${s.subjectId}:${tier}` })
  return out
}

/** The achievement's name and what it says the person did, in words for the apps */
export function describe(a: { kind: AchievementKindName; tier: number; subjectTitle: string | null }): { title: string; description: string } {
  const n = a.tier
  switch (a.kind) {
    case 'TOPICS_MASTERED':
      return { title: n === 1 ? 'First topic mastered' : `${n} topics mastered`, description: n === 1 ? 'You recall a topic well and answer its questions right.' : `You recall ${n} topics well and answer their questions right.` }
    case 'QUIZ_MASTER':
      return { title: n === 1 ? 'Quiz master' : `Quiz master on ${n} topics`, description: `Nine in ten right over at least ${QUIZ_MASTER_MIN_ANSWERS} answers on ${n === 1 ? 'a topic' : `${n} topics`}.` }
    case 'EXAM_READY':
      return { title: n === 1 ? 'Exam ready' : `Ready for ${n} exams`, description: n === 1 ? 'An exam reached its Readiness target before the day.' : `${n} exams reached their Readiness target before the day.` }
    case 'RHYTHM_WEEKS':
      return { title: `${n} Rhythm weeks`, description: `You met your planned days in ${n} weeks.` }
    case 'SUBJECT_CONTRIBUTOR':
      return { title: `${a.subjectTitle ?? 'Subject'} contributor`, description: `Your public notes on ${a.subjectTitle ?? 'the subject'} earned ${n} points from what others did with them.` }
  }
}

/** The award key of an entry: rule, source, actor and how many entries that triple already had */
export function awardKey(rule: PointsRuleName, sourceType: 'NOTE' | 'RESOURCE', sourceId: string, actorId: string | null, n: number): string {
  return `${rule}:${sourceType}:${sourceId}:${actorId ?? '-'}:${n}`
}
