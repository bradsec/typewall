import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  contrastRatio,
  readablePalette,
  bestContrast,
  effectiveBackgroundColor,
  MIN_CONTRAST_RATIO,
} from './contrast'
import { defaultConfig } from '../engine/types'

describe('contrast', () => {
  it('parses 3- and 6-digit hex, with or without #', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('falls back to grey on malformed hex instead of throwing', () => {
    expect(hexToRgb('nope')).toEqual({ r: 128, g: 128, b: 128 })
  })

  it('contrastRatio is ~21 for black/white and 1 for identical', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#abcdef', '#abcdef')).toBe(1)
  })

  it('readablePalette drops colors below the threshold', () => {
    // White background: white fails (ratio 1), black passes (ratio 21).
    const out = readablePalette(['#ffffff', '#000000'], '#ffffff')
    expect(out).toEqual(['#000000'])
  })

  it('bestContrast returns the highest-contrast color', () => {
    expect(bestContrast(['#ffffff', '#cccccc', '#000000'], '#ffffff')).toBe('#000000')
  })

  it('MIN_CONTRAST_RATIO is moderate', () => {
    expect(MIN_CONTRAST_RATIO).toBe(3)
  })

  describe('effectiveBackgroundColor', () => {
    it('returns the solid color for an opaque solid background', () => {
      const bg = defaultConfig().background
      bg.transparent = false
      bg.color = '#123456'
      bg.image.enabled = false
      expect(effectiveBackgroundColor(bg)).toBe('#123456')
    })

    it('returns undefined for a transparent background', () => {
      const bg = defaultConfig().background
      bg.transparent = true
      expect(effectiveBackgroundColor(bg, '#abcabc')).toBeUndefined()
    })

    it('returns the image average color when an image background is enabled', () => {
      const bg = defaultConfig().background
      bg.transparent = false
      bg.image.enabled = true
      bg.image.assetRef = { id: 'backgrounds/x.jpg', kind: 'bundled' }
      expect(effectiveBackgroundColor(bg, '#778899')).toBe('#778899')
    })

    it('returns undefined for an image background with no computed average yet', () => {
      const bg = defaultConfig().background
      bg.transparent = false
      bg.image.enabled = true
      bg.image.assetRef = { id: 'backgrounds/x.jpg', kind: 'bundled' }
      expect(effectiveBackgroundColor(bg)).toBeUndefined()
    })
  })
})
