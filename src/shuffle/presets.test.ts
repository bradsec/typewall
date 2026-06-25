import { describe, it, expect } from 'vitest'
import { VIBE_PRESETS, getVibeBias } from './presets'
import { manifest } from '../assets/manifest'

const fontIds = new Set(manifest.fonts.map((f) => f.id))
const HEX = /^#[0-9a-fA-F]{6}$/

describe('vibe presets', () => {
  it('every preset font id exists in the manifest', () => {
    for (const p of VIBE_PRESETS)
      for (const id of p.bias.fontIds)
        expect(fontIds.has(id), `${p.id}: ${id}`).toBe(true)
  })

  it('every palette color is a 6-digit hex', () => {
    for (const p of VIBE_PRESETS)
      for (const c of p.bias.palette)
        expect(HEX.test(c), `${p.id}: ${c}`).toBe(true)
  })

  it('numeric ranges have min <= max', () => {
    for (const p of VIBE_PRESETS) {
      const b = p.bias
      for (const [lo, hi] of [b.lineSpacing, b.letterSpacing, b.scaleEmphasis, b.sprayOverflow, b.outlineRatio])
        expect(lo).toBeLessThanOrEqual(hi)
    }
  })

  it('alignments are non-empty', () => {
    for (const p of VIBE_PRESETS) expect(p.bias.alignments.length).toBeGreaterThan(0)
  })

  it('getVibeBias returns undefined for unknown / none', () => {
    expect(getVibeBias('none')).toBeUndefined()
    expect(getVibeBias('nope')).toBeUndefined()
    expect(getVibeBias('brutalist')).toBeDefined()
  })
})
