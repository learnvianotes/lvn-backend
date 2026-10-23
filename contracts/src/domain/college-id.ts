/**
 * A college ID card sent to platform admins (ADR-0099).
 * Images or one PDF, about 5 MB. This is not a general upload and does not follow UPLOADS_ENABLED.
 */
export const CollegeIdCardLimits = {
  maxBytes: 5 * 1024 ** 2,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
} as const

export type CollegeIdMimeType = (typeof CollegeIdCardLimits.mimeTypes)[number]

/** The name shown to an admin: no path separators, no control characters, at most 255 characters. */
export function collegeIdFileName(raw: string): string {
  return [...raw].filter((c) => c !== '/' && c !== '\\' && c.charCodeAt(0) >= 0x20).join('').trim().slice(0, 255)
}

export function isCollegeIdMimeType(mimeType: string): mimeType is CollegeIdMimeType {
  return (CollegeIdCardLimits.mimeTypes as readonly string[]).includes(mimeType)
}
