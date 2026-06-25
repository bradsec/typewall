import { describe, it, expect } from 'vitest'
import { Rng } from './rng'
import { renderLine, measureWidth } from './text-render'
import { defaultConfig } from './types'

describe('renderLine', () => {
  it('produces a non-empty canvas with opaque text pixels', () => {
    const cfg = defaultConfig()
    const s = renderLine({ line: { text: 'TRAIN', fontPx: 120 }, fontFamily: 'Anton', text: cfg.text, index: 0, rng: new Rng(1) })
    expect(s.width).toBeGreaterThan(0); expect(s.height).toBeGreaterThan(0)
    const ctx = (s as any).getContext('2d')
    const data = ctx.getImageData(0, 0, s.width, s.height).data
    let opaque = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++
    expect(opaque).toBeGreaterThan(0)
  })
  it('slant rotation makes the canvas taller than an unrotated line', () => {
    const base = defaultConfig().text
    const flat = renderLine({ line: { text: 'TRAIN', fontPx: 120 }, fontFamily: 'Anton', text: { ...base, randomLineSlant: false }, index: 0, rng: new Rng(1) })
    const tilted = renderLine({ line: { text: 'TRAIN', fontPx: 120 }, fontFamily: 'Anton', text: { ...base, randomLineSlant: true }, index: 1, rng: new Rng(1) })
    expect(tilted.height).toBeGreaterThanOrEqual(flat.height)
  })
})

function lineOpts(letterSpacingPct: number) {
  const text = defaultConfig().text
  text.randomLineSlant = false
  text.letterSpacingPct = letterSpacingPct
  return {
    line: { text: 'WIDE', fontPx: 80 },
    fontFamily: 'sans-serif',
    text,
    index: 0,
    rng: new Rng(1),
  }
}

describe('letter spacing', () => {
  it('positive tracking widens the cropped layer vs zero', () => {
    const zero = renderLine(lineOpts(0))
    const wide = renderLine(lineOpts(0.2))
    expect(wide.width).toBeGreaterThan(zero.width)
  })

  it('zero tracking is unchanged (golden parity)', () => {
    const a = renderLine(lineOpts(0))
    const b = renderLine(lineOpts(0))
    expect(a.width).toBe(b.width)
    expect(a.height).toBe(b.height)
  })

  it('undefined letterSpacingPct behaves like zero', () => {
    const text = defaultConfig().text
    text.randomLineSlant = false
    delete (text as { letterSpacingPct?: number }).letterSpacingPct
    const out = renderLine({ line: { text: 'WIDE', fontPx: 80 }, fontFamily: 'sans-serif', text, index: 0, rng: new Rng(1) })
    const zero = renderLine(lineOpts(0))
    expect(out.width).toBe(zero.width)
  })
})

// Fake ctx without `letterSpacing` to force the per-glyph fallback branch in
// measureWidth (real @napi-rs/canvas supports ctx.letterSpacing, so this path
// is otherwise untested under Node).
function fakeCtxNoLetterSpacing(perCharWidth: number): CanvasRenderingContext2D {
  return {
    measureText: (s: string) => ({ width: s.length * perCharWidth }),
  } as unknown as CanvasRenderingContext2D
}

describe('measureWidth fallback (no ctx.letterSpacing)', () => {
  it('advances by width + lsPx per glyph, minus the trailing gap', () => {
    const ctx = fakeCtxNoLetterSpacing(10)
    // 4 glyphs: 4 * (10 + 2) - 2 (no trailing gap after the last glyph)
    expect(measureWidth(ctx, 'WIDE', 2)).toBe(4 * (10 + 2) - 2)
  })

  it('returns 0 for an empty string even with nonzero letter spacing', () => {
    const ctx = fakeCtxNoLetterSpacing(10)
    expect(measureWidth(ctx, '', 2)).toBe(0)
  })
})
