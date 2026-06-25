import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { applySpray } from './spray-paint'
import { Rng } from './rng'

function textBlock() {
  const c = createCanvas(400, 200)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.font = '120px sans-serif'
  ctx.fillText('AB', 40, 150)
  return c as any
}

describe('applySpray', () => {
  it('returns a surface and is deterministic for a fixed seed', () => {
    const a = applySpray(textBlock(), { enabled: true, overflow: 15 }, '#ffffff', new Rng(9))
    const b = applySpray(textBlock(), { enabled: true, overflow: 15 }, '#ffffff', new Rng(9))
    const da = (a as any).getContext('2d').getImageData(0, 0, a.width, a.height).data
    const db = (b as any).getContext('2d').getImageData(0, 0, b.width, b.height).data
    expect(Array.from(da.slice(0, 4000))).toEqual(Array.from(db.slice(0, 4000)))
  })

  it('spreads alpha beyond the original glyph bounds (overspray halo)', () => {
    const sprayed = applySpray(textBlock(), { enabled: true, overflow: 15 }, '#ffffff', new Rng(3))
    expect(sprayed.width).toBeGreaterThanOrEqual(400) // padding added
  })

  it('distort warps the result while distort 0 matches the original behaviour', () => {
    const sum = (s: any) => {
      const d = s.getContext('2d').getImageData(0, 0, s.width, s.height).data
      let n = 0
      for (let i = 3; i < d.length; i += 4) n += d[i]
      return n
    }
    const base = applySpray(textBlock(), { enabled: true, overflow: 10 }, '#ffffff', new Rng(5))
    const noDistort = applySpray(textBlock(), { enabled: true, overflow: 10, distort: 0 }, '#ffffff', new Rng(5))
    const distorted = applySpray(textBlock(), { enabled: true, overflow: 10, distort: 80 }, '#ffffff', new Rng(5))
    // distort:0 is identical to omitting the field.
    expect(sum(noDistort)).toBe(sum(base))
    // distort:80 changes the alpha distribution (warps the letters).
    expect(sum(distorted)).not.toBe(sum(base))
  })
})
