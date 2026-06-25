import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { compositeLines } from './compositor'

function solidLine(w: number, h: number) {
  const c = createCanvas(w, h); const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffffff'; ctx.fillRect(0, 0, w, h); return c as any
}

describe('compositeLines', () => {
  it('returns a canvas of the requested size with content vertically inside bounds', () => {
    const out = compositeLines({ lineSurfaces: [solidLine(200, 80), solidLine(120, 80)],
      canvasW: 1000, canvasH: 1420, padX: 50, padY: 50, lineSpacingPct: 0.05, alignment: 'center', blockText: false })
    expect(out.width).toBe(1000); expect(out.height).toBe(1420)
  })
  it('left vs right alignment place content at different x', () => {
    const left = compositeLines({ lineSurfaces: [solidLine(100, 40)], canvasW: 1000, canvasH: 400, padX: 20, padY: 20, lineSpacingPct: 0, alignment: 'left', blockText: false })
    const right = compositeLines({ lineSurfaces: [solidLine(100, 40)], canvasW: 1000, canvasH: 400, padX: 20, padY: 20, lineSpacingPct: 0, alignment: 'right', blockText: false })
    const firstOpaqueX = (s: any) => { const d = s.getContext('2d').getImageData(0, 0, s.width, s.height).data
      for (let x = 0; x < s.width; x++) for (let y = 0; y < s.height; y++) if (d[(y * s.width + x) * 4 + 3] > 0) return x; return -1 }
    expect(firstOpaqueX(left)).toBeLessThan(firstOpaqueX(right))
  })
})
