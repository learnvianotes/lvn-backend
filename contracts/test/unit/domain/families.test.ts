import { applyMinorPii, applyMinorPiiValue, containsMinorPii, isCaptureUpload, maskMinorPii, minorPiiMode } from '../../../src/domain/families'

describe('minor PII filter', () => {
  const text = 'Email ada@school.edu, call 9876543210, live at 12 Park Street, see instagram.com/ada and @ada_notes'

  it('finds a phone, an email, a street and a social handle', () => {
    expect(containsMinorPii('Photosynthesis uses sunlight.')).toBe(false)
    expect(containsMinorPii(text)).toBe(true)
    expect(maskMinorPii(text)).toBe('Email [removed], call [removed], live at [removed], see [removed] and [removed]')
    expect(maskMinorPii('The Road Not Taken')).toBe('The Road Not Taken')
  })

  it('blocks, redacts, or keeps the text', () => {
    expect(applyMinorPii(text, 'block')).toMatchObject({ blocked: true, changed: false, text })
    expect(applyMinorPii(text, 'redact').text).toContain('[removed]')
    expect(applyMinorPii(text, 'redact').changed).toBe(true)
    expect(applyMinorPii(text, 'off')).toMatchObject({ blocked: false, text })
    expect(minorPiiMode('nope')).toBe('block')
    expect(minorPiiMode('redact')).toBe('redact')
  })

  it('walks a rich-text document and does not rewrite it in block mode', () => {
    const doc = { type: 'doc', content: [{ type: 'text', text: 'Ping me at ada@school.edu' }] }
    expect(applyMinorPiiValue(doc, 'block')).toMatchObject({ blocked: true, value: doc })
    const redacted = applyMinorPiiValue(doc, 'redact')
    expect(redacted.changed).toBe(true)
    expect(JSON.stringify(redacted.value)).toContain('[removed]')
    expect(JSON.stringify(redacted.value)).not.toContain('ada@school.edu')
    expect(applyMinorPiiValue(doc, 'off').value).toBe(doc)
  })
})

describe('capture uploads', () => {
  it('treats voice, audio and video as capture, and a still image as not', () => {
    expect(isCaptureUpload('VOICE_NOTE', 'audio/webm')).toBe(true)
    expect(isCaptureUpload('ATTACHMENT', 'audio/mpeg')).toBe(true)
    expect(isCaptureUpload('ATTACHMENT', 'video/mp4')).toBe(true)
    expect(isCaptureUpload('ATTACHMENT', 'image/jpeg')).toBe(false)
    expect(isCaptureUpload('PAGE_IMAGE', 'image/png')).toBe(false)
    expect(isCaptureUpload('AVATAR', 'image/webp')).toBe(false)
  })
})
