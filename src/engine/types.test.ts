import { describe, it, expect } from 'vitest'
import { defaultConfig } from './types'

describe('defaultConfig', () => {
  it('produces a fully-populated config with sane defaults', () => {
    const c = defaultConfig()
    expect(c.text.baseFontSize).toBeGreaterThan(0)
    expect(c.text.alignment).toBe('center')
    expect(c.sizeFormat.width).toBeGreaterThan(0)
    expect(c.seed).toBe(0)
    expect(c.text.sprayPaint.enabled).toBe(false)
    expect(['left', 'center', 'right']).toContain(c.text.alignment)
  })

  it('defaultConfig includes a disabled meme block', () => {
    const m = defaultConfig().text.meme
    expect(m).toEqual({ enabled: false, style: 'overlay', topText: '', bottomText: '', captionScale: 1 })
  })
})
