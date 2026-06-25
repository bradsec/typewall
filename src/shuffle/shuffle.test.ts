// src/shuffle/shuffle.test.ts
import { describe, it, expect } from 'vitest'
import { shuffle } from './shuffle'
import { defaultConfig } from '../engine/types'
import { getVibeBias } from './presets'

const opts = { palette: ['#fff', '#f00', '#0f0'], fontRefs: [{id:'a',kind:'bundled' as const},{id:'b',kind:'bundled' as const}], fontMix: false }
const allUnlocked = { layout: false, fonts: false, scale: false, effects: false, color: false }

describe('shuffle', () => {
  it('is deterministic for a fixed seed + locks', () => {
    const base = defaultConfig()
    expect(shuffle(base, allUnlocked, 77, opts)).toEqual(shuffle(base, allUnlocked, 77, opts))
  })
  it('locked color is preserved', () => {
    const base = defaultConfig(); base.text.color = '#abcdef'
    const out = shuffle(base, { ...allUnlocked, color: true }, 5, opts)
    expect(out.text.color).toBe('#abcdef')
  })
  it('unlocked color comes from the palette', () => {
    const base = defaultConfig()
    const out = shuffle(base, allUnlocked, 5, opts)
    expect(opts.palette).toContain(out.text.color)
  })
  it('skips palette colors with too little contrast against the background', () => {
    // White background: white (ratio 1) must never be chosen; black always is.
    const bw = { ...opts, palette: ['#ffffff', '#000000'], backgroundColor: '#ffffff' }
    for (let seed = 0; seed < 50; seed++) {
      expect(shuffle(defaultConfig(), allUnlocked, seed, bw).text.color).toBe('#000000')
    }
  })
  it('falls back to the highest-contrast color when none clear the threshold', () => {
    // All near-white palette on a white background: pick the darkest available.
    const low = { ...opts, palette: ['#fefefe', '#f0f0f0', '#eaeaea'], backgroundColor: '#ffffff' }
    expect(shuffle(defaultConfig(), allUnlocked, 3, low).text.color).toBe('#eaeaea')
  })
  it('no backgroundColor leaves the color roll unfiltered', () => {
    const base = defaultConfig()
    const out = shuffle(base, allUnlocked, 5, opts) // opts has no backgroundColor
    expect(opts.palette).toContain(out.text.color)
  })
  it('no-bias shuffle leaves letterSpacingPct untouched', () => {
    const base = defaultConfig(); base.text.content = 'hello world'; base.text.letterSpacingPct = 0.13
    const out = shuffle(base, allUnlocked, 7, opts) // opts has no bias
    expect(out.text.letterSpacingPct).toBe(0.13)
  })
  it('different seeds usually differ', () => {
    const base = defaultConfig()
    expect(shuffle(base, allUnlocked, 1, opts)).not.toEqual(shuffle(base, allUnlocked, 2, opts))
  })
  it('effects shuffle varies shadow/outline offset, ratio, and colors from palette', () => {
    const base = defaultConfig()
    const out = shuffle(base, allUnlocked, 9, opts)
    expect(out.text.shadow.offsetX).toBeGreaterThanOrEqual(-0.006)
    expect(out.text.shadow.offsetX).toBeLessThanOrEqual(0.006)
    expect(out.text.outline.ratio).toBeGreaterThanOrEqual(0.008)
    expect(out.text.outline.ratio).toBeLessThanOrEqual(0.04)
    expect(opts.palette).toContain(out.text.shadow.color)
    expect(opts.palette).toContain(out.text.outline.color)
  })
  it('locked effects preserve shadow/outline values', () => {
    const base = defaultConfig()
    base.text.shadow.color = '#123456'; base.text.shadow.offsetX = 0.001
    base.text.outline.ratio = 0.02
    const out = shuffle(base, { ...allUnlocked, effects: true }, 9, opts)
    expect(out.text.shadow.color).toBe('#123456')
    expect(out.text.shadow.offsetX).toBe(0.001)
    expect(out.text.outline.ratio).toBe(0.02)
  })
  it('meme mode shuffle only re-rolls line breaks and preserves the traditional look', () => {
    const base = defaultConfig()
    base.fontRef = { id: 'fonts/Anton.ttf', kind: 'bundled' }
    base.text.meme = { enabled: true, style: 'overlay', topText: 'one does not simply', bottomText: 'walk into mordor' }
    base.text.color = '#ffffff'
    base.text.outline = { enabled: true, color: '#000000', ratio: 0.025 }
    base.text.shadow = { ...base.text.shadow, enabled: false, color: '#666666' }
    const lineCounts = new Set<number | undefined>()
    const scales = new Set<number | undefined>()
    for (let seed = 1; seed <= 20; seed++) {
      const out = shuffle(base, allUnlocked, seed, opts)
      // Traditional meme look is untouched.
      expect(out.fontRef.id).toBe('fonts/Anton.ttf')
      expect(out.text.color).toBe('#ffffff')
      expect(out.text.outline).toEqual({ enabled: true, color: '#000000', ratio: 0.025 })
      expect(out.text.shadow.enabled).toBe(false)
      expect(out.text.meme!.style).toBe('overlay')           // style not flipped
      const scale = out.text.meme!.captionScale!
      expect(scale).toBeGreaterThanOrEqual(0.45)
      expect(scale).toBeLessThanOrEqual(1.0)
      lineCounts.add(out.text.targetLines)
      scales.add(scale)
    }
    // Line breaks and caption size both vary across seeds.
    expect(lineCounts.size).toBeGreaterThan(1)
    expect(scales.size).toBeGreaterThan(1)
  })
  it('meme mode respects the layout lock (no line-break change)', () => {
    const base = defaultConfig()
    base.text.meme = { enabled: true, style: 'bars', topText: 'a b c', bottomText: '' }
    base.text.targetLines = 2
    const out = shuffle(base, { ...allUnlocked, layout: true, scale: true }, 7, opts)
    expect(out.text.targetLines).toBe(2)
    expect(out.text.meme!.style).toBe('bars')
  })
})

const fontPool = [
  { id: 'fonts/Anton.ttf', kind: 'bundled' as const },
  { id: 'fonts/Audiowide.ttf', kind: 'bundled' as const },
  { id: 'fonts/Monoton.ttf', kind: 'bundled' as const },
  { id: 'fonts/Lobster.ttf', kind: 'bundled' as const },
]

describe('shuffle with vibe bias', () => {
  const bias = getVibeBias('brutalist')!
  const biasOpts = { palette: ['#fff'], fontRefs: fontPool, fontMix: false, bias }

  it('rolled alignment comes from the bias set', () => {
    const base = defaultConfig(); base.text.content = 'hello world'
    for (let s = 1; s <= 15; s++) {
      const out = shuffle(base, allUnlocked, s, biasOpts)
      expect(bias.alignments).toContain(out.text.alignment)
    }
  })

  it('rolled font is within the filtered pool', () => {
    const base = defaultConfig(); base.text.content = 'hello world'
    const allowed = new Set(bias.fontIds)
    for (let s = 1; s <= 15; s++) {
      const out = shuffle(base, allUnlocked, s, biasOpts)
      expect(allowed.has(out.fontRef.id)).toBe(true)
    }
  })

  it('letterSpacingPct stays within the bias range', () => {
    const base = defaultConfig(); base.text.content = 'hi'
    for (let s = 1; s <= 15; s++) {
      const out = shuffle(base, allUnlocked, s, biasOpts)
      const ls = out.text.letterSpacingPct ?? 0
      expect(ls).toBeGreaterThanOrEqual(bias.letterSpacing[0])
      expect(ls).toBeLessThanOrEqual(bias.letterSpacing[1])
    }
  })

  it('forced-off toggle (brutalist slant) disables slant', () => {
    const base = defaultConfig(); base.text.content = 'a b c'
    for (let s = 1; s <= 10; s++)
      expect(shuffle(base, allUnlocked, s, biasOpts).text.randomLineSlant).toBe(false)
  })

  it('palette from bias drives color', () => {
    const base = defaultConfig(); base.text.content = 'x'
    const out = shuffle(base, allUnlocked, 3, biasOpts)
    expect(bias.palette).toContain(out.text.color)
  })

  it('empty font intersection falls back to the full pool', () => {
    const ghost = { ...bias, fontIds: ['fonts/DoesNotExist.ttf'] }
    const out = shuffle(defaultConfig(), allUnlocked, 4, { palette: ['#fff'], fontRefs: fontPool, fontMix: false, bias: ghost })
    expect(fontPool.map((f) => f.id)).toContain(out.fontRef.id)
  })

  it('locked layout is preserved under a bias', () => {
    const base = defaultConfig(); base.text.alignment = 'right'; base.text.letterSpacingPct = 0.11
    const out = shuffle(base, { ...allUnlocked, layout: true }, 5, biasOpts)
    expect(out.text.alignment).toBe('right')
    expect(out.text.letterSpacingPct).toBe(0.11)
  })

  it('is deterministic with a bias', () => {
    const base = defaultConfig(); base.text.content = 'hello world'
    expect(shuffle(base, allUnlocked, 8, biasOpts)).toEqual(shuffle(base, allUnlocked, 8, biasOpts))
  })
})
