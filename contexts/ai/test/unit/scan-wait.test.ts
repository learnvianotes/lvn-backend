import { AppError, Errors } from '@lvn-backend/errors'
import { SCAN_RECHECK_MS, SCAN_WAIT_MS, scanPending } from '../../src/application/ai-tasks.service'

describe('an AI task waits for a file that is still being scanned', () => {
  it('recognises the notes context refusal for a file in the virus scan', () => {
    expect(scanPending(Errors.unavailable('This file is still being scanned.'))).toBe(true)
    expect(scanPending(Errors.unavailable('This picture is still being scanned.'))).toBe(true)
  })

  it('does not wait on other failures', () => {
    expect(scanPending(Errors.unavailable('The model is not answering.'))).toBe(false)
    expect(scanPending(Errors.validation('This file could not be scanned, so it is not available.'))).toBe(false)
    expect(scanPending(new Error('This file is still being scanned.'))).toBe(false)
    expect(scanPending(new AppError('NOT_FOUND', 'File not found.'))).toBe(false)
  })

  it('looks again every few seconds and gives up after a quarter of an hour', () => {
    expect(SCAN_RECHECK_MS).toBeLessThanOrEqual(10_000)
    expect(SCAN_WAIT_MS).toBe(15 * 60_000)
  })
})
