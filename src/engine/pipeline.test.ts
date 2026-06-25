import { describe, it, expect } from 'vitest'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { render, computeSlantAngles } from './pipeline'
import { applySpray } from './spray-paint'
import { Rng } from './rng'
import { defaultConfig } from './types'
import { createSurface, getCtx } from './surface'

GlobalFonts.registerFromPath('fonts/Anton.ttf', 'Anton')

describe('render', () => {
  it('fills a canvas and draws text pixels', () => {
    const cfg = defaultConfig()
    cfg.text.content = 'TRAIN//HARD'
    cfg.background.transparent = false
    cfg.text.sprayPaint.enabled = false
    const target = createCanvas(cfg.sizeFormat.width, cfg.sizeFormat.height)
    render(cfg, target as any, { fontFamily: 'Anton' })
    const d = target.getContext('2d')!.getImageData(0, 0, target.width, target.height).data
    let nonBg = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) nonBg++
    expect(nonBg).toBeGreaterThan(0)
  })
  it('is deterministic given a fixed seed (spray on)', () => {
    const cfg = defaultConfig(); cfg.text.content = 'AB'; cfg.seed = 123
    const run = () => { const t = createCanvas(400, 400); render(cfg, t as any, { fontFamily: 'Anton' }); return t.getContext('2d')!.getImageData(0,0,400,400).data }
    expect(Array.from(run().slice(0, 2000))).toEqual(Array.from(run().slice(0, 2000)))
  })
})

describe('slant min-angle gap', () => {
  it('consecutive slant angles differ by at least 1 degree for a fixed seed', () => {
    const angles = computeSlantAngles(6, 777)
    for (let i = 1; i < angles.length; i++) {
      expect(Math.abs(angles[i] - angles[i - 1])).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('spray scale', () => {
  function textBlock() {
    const c = createCanvas(400, 200)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.font = '120px sans-serif'
    ctx.fillText('AB', 40, 150)
    return c as any
  }

  it('two different scale factors produce different spray output for the same seed', () => {
    const cfg = { enabled: true, overflow: 15 }
    const small = applySpray(textBlock(), cfg, '#ffffff', new Rng(7), 0.5)
    const big = applySpray(textBlock(), cfg, '#ffffff', new Rng(7), 2.0)
    const da = (small as any).getContext('2d').getImageData(0, 0, small.width, small.height).data
    const db = (big as any).getContext('2d').getImageData(0, 0, big.width, big.height).data
    let diff = 0
    for (let i = 3; i < da.length; i += 4) if (da[i] !== db[i]) diff++
    expect(diff).toBeGreaterThan(0)
  })
})

describe('meme mode', () => {
  it('meme mode draws top/bottom captions and skips centered body text', () => {
    const cfg = defaultConfig()
    cfg.sizeFormat = { name: 'square', width: 400, height: 400 }
    cfg.background.transparent = true
    cfg.text.content = 'IGNORED BODY'
    cfg.text.color = '#ffffff'
    cfg.text.meme = { enabled: true, style: 'overlay', topText: 'TOP', bottomText: 'BOT' }
    const canvas = createSurface(400, 400)
    render(cfg, canvas, { fontFamily: 'Anton' })
    const ctx = getCtx(canvas)
    const mid = ctx.getImageData(0, 180, 400, 40).data
    let ink = 0
    for (let i = 3; i < mid.length; i += 4) if (mid[i] > 0) ink++
    expect(ink).toBe(0)
  })
})
