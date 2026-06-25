import { describe, it, expect } from 'vitest'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { fitText } from './font-fit'
import { measureWidth } from './text-render'

const ctx = createCanvas(1000, 1420).getContext('2d')!
// Register known fonts for deterministic measurement. Anton is narrow/condensed;
// PressStart2P is a wide monospace, so the same text is far wider in it.
GlobalFonts.registerFromPath('fonts/Anton.ttf', 'Anton')
GlobalFonts.registerFromPath('fonts/PressStart2P.ttf', 'PressStart2P')

describe('fitText', () => {
  it('scales font so the widest line fits available width', () => {
    const r = fitText(ctx as any, { lines: ['WIDESTLINE', 'a'], fontFamily: 'Anton',
      baseFontPx: 100, availW: 800, availH: 1200, lineSpacingPct: 0.05, blockText: false, canvasH: 1420 })
    ctx.font = `${r.maxFontPx}px Anton`
    expect(ctx.measureText('WIDESTLINE').width).toBeLessThanOrEqual(800 + 1)
    expect(r.maxFontPx).toBeGreaterThan(0)
  })
  it('sizes each line with its own per-line font so the widest fits availW', () => {
    // Both lines have equal char count, but line 2 uses the much wider
    // PressStart2P. The fit must shrink based on line 2 in its own font.
    const r = fitText(ctx as any, { lines: ['ABCDE', 'ABCDE'], fontFamily: 'Anton',
      perLineFonts: ['Anton', 'PressStart2P'],
      baseFontPx: 100, availW: 800, availH: 1200, lineSpacingPct: 0.05, blockText: false, canvasH: 1420 })
    ctx.font = `${r.maxFontPx}px PressStart2P`
    expect(ctx.measureText('ABCDE').width).toBeLessThanOrEqual(800 + 1)
    expect(r.maxFontPx).toBeGreaterThan(0)
  })
  it('keeps the tracked widest line within availW when letter spacing is set', () => {
    const lsPct = 0.25
    const r = fitText(ctx as any, { lines: ['WIDESTLINE', 'a'], fontFamily: 'Anton',
      baseFontPx: 100, availW: 800, availH: 1200, lineSpacingPct: 0.05, blockText: false,
      canvasH: 1420, letterSpacingPct: lsPct })
    const lsPx = Math.round(lsPct * r.maxFontPx)
    ctx.font = `${r.maxFontPx}px Anton`
    // Measured the same way renderLine measures, so fit and render agree.
    expect(measureWidth(ctx as any, 'WIDESTLINE', lsPx)).toBeLessThanOrEqual(800 + 1)
    expect(r.maxFontPx).toBeGreaterThan(0)
  })
  it('blockText gives shorter lines a larger font than the widest line', () => {
    const r = fitText(ctx as any, { lines: ['WIDEST', 'i'], fontFamily: 'Anton',
      baseFontPx: 100, availW: 800, availH: 1200, lineSpacingPct: 0.05, blockText: true, canvasH: 1420 })
    const wide = r.lines.find(l => l.text === 'WIDEST')!
    const narrow = r.lines.find(l => l.text === 'i')!
    expect(narrow.fontPx).toBeGreaterThan(wide.fontPx)
  })
})
