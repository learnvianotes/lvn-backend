/**
 * Home's line for the day (ADR-0087) when AI has not written one: a line chosen for the person and the day, so it still
 * changes daily. Our own words: no quotes put in famous people's mouths.
 */
export const CHOSEN_LINES: readonly { title: string; line: string }[] = [
  { title: 'Make it happen', line: 'Discipline today creates the freedom tomorrow.' },
  { title: 'Small steps count', line: 'Ten focused minutes today beat a perfect plan for someday.' },
  { title: 'One page at a time', line: 'Read one page well; understanding grows from there.' },
  { title: 'Show up today', line: 'You do not need to feel ready. Start, and readiness follows.' },
  { title: 'Ask, then learn', line: 'A question you write down today is a mistake you will not make in the exam.' },
  { title: 'Practice beats rereading', line: 'Test yourself: recalling an answer teaches more than reading it again.' },
  { title: 'Keep the streak kind', line: 'Missed a day? Today is a fine day to come back.' },
  { title: 'Focus wins', line: 'Put the phone face down and give one topic your full attention.' },
  { title: 'Teach it back', line: 'Explain today’s topic in your own words; gaps show up fast.' },
  { title: 'Little and often', line: 'A short review every day keeps what you learned from fading.' },
  { title: 'Curiosity first', line: 'Follow the question that interests you most; motivation will come along.' },
  { title: 'Progress, not perfection', line: 'Messy notes that you made beat neat notes you never wrote.' },
  { title: 'Build the habit', line: 'Same time, same place: let the routine do the hard part.' },
  { title: 'Hard is good', line: 'If it feels difficult, your brain is doing the work that makes it stick.' },
  { title: 'Plan the next step', line: 'Know what you will study next before you close the app.' },
  { title: 'Rest is part of it', line: 'Sleep turns today’s learning into tomorrow’s memory.' },
  { title: 'Review the tricky one', line: 'Go back to the topic you skipped; it is smaller than it looks.' },
  { title: 'Learn together', line: 'Share a note or a doubt today; someone else is stuck on it too.' },
  { title: 'Start with five', line: 'Promise yourself five minutes. Most days, you will keep going.' },
  { title: 'Trust the process', line: 'Steady work adds up, even on the days it does not feel like it.' },
  { title: 'Today’s one thing', line: 'Pick one thing to understand by tonight, and finish it.' },
]

/** The chosen line for a person's day: a different one each day, and not the same for everyone on the same day. */
export function chosenLine(userId: string, day: string): { title: string; line: string } {
  let hash = 0
  for (const ch of `${userId}:${day}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CHOSEN_LINES[hash % CHOSEN_LINES.length]!
}

/** "Wednesday 14 October" for a learning day (YYYY-MM-DD). */
export function spokenDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}
