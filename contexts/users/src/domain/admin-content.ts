import { docSchema, docText } from '@lvn/contracts/validation'

/** Kinds a platform admin can browse. Private notes and college ID cards are not kinds of their own; they are left out. */
export const ADMIN_CONTENT_TYPES = ['NOTE', 'COMMENT', 'GROUP', 'GROUP_POST', 'CLASSROOM', 'CLASSROOM_POST', 'QUIZ', 'DOUBT', 'DOUBT_ANSWER', 'SHARE', 'UPLOAD', 'RESOURCE', 'HIGHLIGHT', 'CONTEST'] as const
export type AdminContentType = (typeof ADMIN_CONTENT_TYPES)[number]

export const ADMIN_VISIBILITIES = ['PUBLIC', 'SHARED', 'UNLISTED', 'PRIVATE', 'MEMBERS'] as const
export type AdminContentVisibility = (typeof ADMIN_VISIBILITIES)[number]

export const EXCERPT_MAX = 200

/** One line, at most 200 characters. Empty becomes null. */
export function clip(value: string | null | undefined): string | null {
  if (!value) return null
  const flat = value.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length <= EXCERPT_MAX ? flat : flat.slice(0, EXCERPT_MAX)
}

/** Title when the item has one, and a short text: the body, or the title when there is no body. */
export function titleAndExcerpt(title: string | null | undefined, body: string | null | undefined): { title: string | null; excerpt: string | null } {
  const clippedTitle = clip(title)
  const clippedBody = clip(body)
  return { title: clippedTitle, excerpt: clippedBody ?? clippedTitle }
}

/** Plain text of a rich-text document. Anything else is empty. */
export function richText(body: unknown): string | null {
  const parsed = docSchema.safeParse(body)
  if (!parsed.success) return null
  return docText(parsed.data)
}
