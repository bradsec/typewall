import { describe, it, expect } from 'vitest'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { drawMeme } from './meme-layout'
import { defaultConfig } from './types'
import { Rng } from './rng'

GlobalFonts.registerFromPath('fonts/Anton.ttf', 'Anton')

function memeText(over: Partial<ReturnType<typeof defaultConfig>['text']['meme']>) {
  const t = defaultConfig().text
  t.color = '#ffffff'
  t.outline = { enabled: true, color: '#000000', ratio: 0.025 }
  t.meme = { enabled: true, style: 'overlay', topText: '', bottomText: '', ...over }
  return t
}

function bandAlpha(ctx: any, w: number, y0: number, y1: number): number {
  const d = ctx.getImageData(0, 0, w, y1).data
  let n = 0
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) n++
  return n
}

describe('drawMeme', () => {
  const W = 600, H = 600

  it('draws the top caption in the top region and bottom caption in the bottom region', () => {
    const c = createCanvas(W, H)
    const ctx = c.getContext('2d') as any
    drawMeme(ctx, W, H, memeText({ topText: 'TOP', bottomText: 'BOTTOM' }), 'Anton', new Rng(1))
    expect(bandAlpha(ctx, W, 0, H * 0.35)).toBeGreaterThan(0)
    expect(bandAlpha(ctx, W, H * 0.65, H)).toBeGreaterThan(0)
    expect(bandAlpha(ctx, W, H * 0.4, H * 0.6)).toBe(0)
  })

  it('renders only the present caption when one is empty', () => {
    const c = createCanvas(W, H)
    const ctx = c.getContext('2d') as any
    drawMeme(ctx, W, H, memeText({ topText: 'ONLY TOP', bottomText: '' }), 'Anton', new Rng(1))
    expect(bandAlpha(ctx, W, 0, H * 0.35)).toBeGreaterThan(0)
    expect(bandAlpha(ctx, W, H * 0.65, H)).toBe(0)
  })

  it('bars style fills a black band behind the caption', () => {
    const c = createCanvas(W, H)
    const ctx = c.getContext('2d') as any
    drawMeme(ctx, W, H, memeText({ style: 'bars', topText: 'BAR', bottomText: '' }), 'Anton', new Rng(1))
    const row = ctx.getImageData(0, 2, W, 1).data
    let black = 0
    for (let x = 0; x < W; x++) {
      const i = x * 4
      if (row[i] === 0 && row[i + 1] === 0 && row[i + 2] === 0 && row[i + 3] === 255) black++
    }
    expect(black).toBeGreaterThan(W * 0.9)
  })

  it('uppercases caption text regardless of input case', () => {
    const c = createCanvas(W, H)
    const ctx = c.getContext('2d') as any
    const lower = createCanvas(W, H).getContext('2d') as any
    drawMeme(ctx, W, H, memeText({ topText: 'HELLO', bottomText: '' }), 'Anton', new Rng(1))
    drawMeme(lower, W, H, memeText({ topText: 'hello', bottomText: '' }), 'Anton', new Rng(1))
    expect(bandAlpha(lower, W, 0, H * 0.35)).toBe(bandAlpha(ctx, W, 0, H * 0.35))
  })
})
