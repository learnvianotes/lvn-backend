/** Shown instead of a minor's model answer that the output filter refused. No personal data. */
export const MINOR_SAFE_MESSAGE = 'I can’t show that answer. I can help with your studies — try asking about something from your notes.'

/**
 * Shown when the refused answer was about self-harm. The numbers are public helplines, not the student's.
 * iCall and AASRA cover India; the IASP page finds a local line elsewhere.
 */
export const MINOR_SELF_HARM_MESSAGE =
  'If you or someone else might be in danger, please talk to a trusted adult right away. In India you can call iCall on 9152987821 or AASRA on 9820466726, or the emergency number 112. You can also find local help at https://www.iasp.info/suicidalthoughts/. I can’t continue with that topic, but I can help with your studies.'

export type MinorOutputCategory = 'sexual' | 'violent' | 'self-harm' | 'pii'

export type MinorOutputVerdict = { ok: true } | { ok: false; category: MinorOutputCategory; message: string }

const SEXUAL = /\b(porn(?:ography)?|xxx|nudes?|erotic|orgasm|penis|vagina|blowjob|handjob|masturbat\w*|hentai|nsfw|sexual intercourse|sexually explicit)\b/i
const SEXUAL_MINOR = /\b(child|underage|minor)s?\b.{0,24}\b(sex|nude|porn)/i
const VIOLENT = /\b(behead\w*|dismember\w*|disembowel\w*|how to (?:kill|murder|stab|shoot))\b/i
const SELF_HARM = /\b(suicid\w*|kill myself|killing myself|self-harm|self harm|cut myself|cutting myself|want to die|end my life)\b/i
const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i
const PERSONAL = /\b(my (?:home )?address is|i live at|my phone(?: number)? is|whatsapp me at)\b/i

/**
 * A rule-based check of a minor's model answer, before it is returned. Study text passes. A blocked answer is
 * replaced with {@link MINOR_SAFE_MESSAGE}, or the helpline message when the category is self-harm. The caller's
 * log records the category only.
 */
export function filterMinorOutput(text: string): MinorOutputVerdict {
  if (SELF_HARM.test(text)) return block('self-harm')
  if (SEXUAL.test(text) || SEXUAL_MINOR.test(text)) return block('sexual')
  if (VIOLENT.test(text)) return block('violent')
  if (EMAIL.test(text) || PERSONAL.test(text)) return block('pii')
  return { ok: true }
}

function block(category: MinorOutputCategory): MinorOutputVerdict {
  return { ok: false, category, message: category === 'self-harm' ? MINOR_SELF_HARM_MESSAGE : MINOR_SAFE_MESSAGE }
}

/** The child-safety prompt in front of the template's system message. Adults are not passed through here. */
export function withChildSafety(system: string, prompt: string): string {
  const rule = prompt.trim()
  if (!rule) return system
  return `${rule}\n\n${system}`
}
