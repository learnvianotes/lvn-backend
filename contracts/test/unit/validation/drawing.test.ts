import { DRAWING_LIMITS, parseDrawing, parsePageImagePlacement } from '../../../src/validation/drawing'

const pen = { id: 's1', tool: 'pen', color: '#112233', width: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 2 }] }

describe('drawing', () => {
  it('accepts pen, marker, eraser and a two-point ruler', () => {
    const parsed = parseDrawing({
      strokes: [pen, { id: 's2', tool: 'marker', color: '#abcdef', width: 8, points: [{ x: 1, y: 1 }] }, { id: 's3', tool: 'eraser', width: 12, points: [{ x: 2, y: 2 }] }, { id: 's4', tool: 'ruler', color: '#000000', width: 1, points: [{ x: 0, y: 0 }, { x: 4, y: 4 }] }],
    })
    expect(parsed.ok).toBe(true)
  })

  it('refuses a pen without a colour and a ruler that is not two points', () => {
    expect(parseDrawing({ strokes: [{ ...pen, color: undefined }] }).ok).toBe(false)
    expect(parseDrawing({ strokes: [{ id: 'r', tool: 'ruler', width: 1, points: [{ x: 0, y: 0 }] }] }).ok).toBe(false)
    expect(parseDrawing({ strokes: [{ ...pen, color: 'red' }] }).ok).toBe(false)
  })

  it('stops at the stroke cap', () => {
    const strokes = Array.from({ length: DRAWING_LIMITS.strokes + 1 }, (_, i) => ({ ...pen, id: `s${i}` }))
    expect(parseDrawing({ strokes }).ok).toBe(false)
  })

  it('places an image with a rotation', () => {
    expect(parsePageImagePlacement({ x: 10, y: -4, width: 80, height: 40, rotation: 90 })).toEqual({ ok: true, placement: { x: 10, y: -4, width: 80, height: 40, rotation: 90 } })
    expect(parsePageImagePlacement({ x: 0, y: 0, width: 0, height: 10, rotation: 0 }).ok).toBe(false)
  })
})
