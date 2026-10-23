import { CollegeIdCardLimits, collegeIdFileName, isCollegeIdMimeType } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'

/** What a person reads when an admin has not turned college-ID verification on (ADR-0099). */
export const COLLEGE_ID_OFF = 'College ID verification is off for now. Ask a teacher to verify you, or add your college email.'

/** Presigned upload intents, separate from the three verification requests a week. */
export const COLLEGE_ID_UPLOADS_PER_DAY = 10

/** How long an admin's link to a college ID card works. Shorter than the 15 minutes used for other files. */
export const COLLEGE_ID_CARD_URL_SECONDS = 5 * 60

/** File name, type and size of a college ID card, or a validation error naming the input field. */
export function checkedCollegeIdFile(input: { fileName: string; mimeType: string; sizeBytes: number }): { fileName: string; mimeType: string; sizeBytes: number } {
  const fileName = collegeIdFileName(input.fileName)
  if (!fileName) throw Errors.validation('Give the file a name.', ['input', 'fileName'])
  if (!isCollegeIdMimeType(input.mimeType)) throw Errors.validation('Use a JPEG, PNG, WebP or PDF of your college ID card.', ['input', 'mimeType'])
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1) throw Errors.validation('The file is empty.', ['input', 'sizeBytes'])
  if (input.sizeBytes > CollegeIdCardLimits.maxBytes) throw Errors.validation('A college ID card can be at most 5 MB.', ['input', 'sizeBytes'])
  return { fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes }
}
