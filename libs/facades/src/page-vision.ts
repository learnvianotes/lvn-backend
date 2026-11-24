import type { NewCard } from './note-ai'

/**
 * A PDF page read again by the vision model (stage 4 of ADR-0028, ADR-0063): asked by `notes` while it turns a PDF into
 * cards, answered by `ai` through the gateway as the platform's work.
 */
export const PAGE_VISION = Symbol('PAGE_VISION')

export interface PageVision {
  /** Whether a page can be read now (AI on and answering); otherwise conversion keeps the OCR's cards. */
  available(): Promise<boolean>
  /** A page image (PNG, base64) transcribed verbatim, as cards of our types, and its words. `subjectId` is the person whose PDF it is. */
  read(png: string, subjectId?: string | null): Promise<{ cards: NewCard[]; text: string }>
}
