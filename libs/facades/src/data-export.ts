/**
 * Data exports (ADR-0018): `users` assembles one archive of everything a person created or that describes them; each
 * context contributes its part through one of these tokens. A context that stores new personal data adds it to its
 * part in the same change (§19 checklist).
 */
export const NOTES_DATA_EXPORT = Symbol('NOTES_DATA_EXPORT')
export const CORE_DATA_EXPORT = Symbol('CORE_DATA_EXPORT')

export interface ExportFile {
  /** Path inside the archive, e.g. notes/NOTE/graphs-01a2b3c4/index.md */
  path: string
  bytes: Uint8Array
}

export interface DataExportPart {
  /** This context's files for one person; `budgetBytes` bounds media originals (anything larger is listed instead). */
  exportFor(userId: string, budgetBytes: number): Promise<{ files: ExportFile[]; counts: Record<string, number>; omitted: string[] }>
}
