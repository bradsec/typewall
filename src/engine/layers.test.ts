import { describe, it, expect } from 'vitest'
import { createSurface, getCtx } from './surface'
import { placeWatermark, applyTextMask, drawBorder } from './layers'

const logo = () => {
  const c = createSurface(50, 50)
  const x = getCtx(c)
  x.fillStyle = '#00ff00'
  x.fillRect(0, 0, 50, 50)
  return c
}

describe('layers', () => {
  it('top-left vs bottom-right watermark land in different corners', () => {
    const mk = (pos: any) => {
      const c = createSurface(500, 500)
      placeWatermark(getCtx(c), logo(), pos, 0.2, 0.05, 255, 500, 500)
      return c
    }
    const tl = getCtx(mk('top-left')).getImageData(0, 0, 500, 500).data
    const br = getCtx(mk('bottom-right')).getImageData(0, 0, 500, 500).data
    const greenAt = (d: Uint8ClampedArray, x: number, y: number) => d[(y * 500 + x) * 4 + 1] > 100
    expect(greenAt(tl, 50, 50)).toBe(true)
    expect(greenAt(br, 450, 450)).toBe(true)
  })
  it('text mask cuts text under bright pixels and keeps it under dark pixels', () => {
    const newBlock = () => {
      const block = createSurface(20, 20)
      const bx = getCtx(block)
      bx.fillStyle = '#fff'
      bx.fillRect(0, 0, 20, 20)
      return block
    }

    // Mask: left half white (bright), right half black (dark), both opaque.
    const mask = createSurface(20, 20)
    const mx = getCtx(mask)
    mx.fillStyle = '#000'
    mx.fillRect(0, 0, 20, 20)
    mx.fillStyle = '#fff'
    mx.fillRect(0, 0, 10, 20)

    const d = getCtx(applyTextMask(newBlock(), mask)).getImageData(0, 0, 20, 20).data
    // Left half: white -> luminance 1 -> text cut (alpha 0).
    expect(d[(0 * 20 + 5) * 4 + 3]).toBe(0)
    // Right half: black -> luminance 0 -> text kept.
    expect(d[(0 * 20 + 15) * 4 + 3]).toBeGreaterThan(0)

    // Transparent mask pixels never cut, even if RGB is bright.
    const clearMask = createSurface(20, 20) // fully transparent
    const dc = getCtx(applyTextMask(newBlock(), clearMask)).getImageData(0, 0, 20, 20).data
    expect(dc[(0 * 20 + 5) * 4 + 3]).toBeGreaterThan(0)

    // Opacity scales the cut: at 0 strength nothing is removed.
    const dz = getCtx(applyTextMask(newBlock(), mask, 'cover', 0)).getImageData(0, 0, 20, 20).data
    expect(dz[(0 * 20 + 5) * 4 + 3]).toBeGreaterThan(0)
  })
  it('drawBorder paints a frame at the edges and leaves the center clear', () => {
    const c = createSurface(100, 100)
    const ctx = getCtx(c)
    drawBorder(ctx, 100, 100, '#ff0000', 10)
    const d = ctx.getImageData(0, 0, 100, 100).data
    const redAt = (x: number, y: number) => {
      const i = (y * 100 + x) * 4
      return d[i] > 200 && d[i + 1] < 50 && d[i + 2] < 50 && d[i + 3] === 255
    }
    expect(redAt(2, 50)).toBe(true)    // left edge
    expect(redAt(97, 50)).toBe(true)   // right edge
    expect(redAt(50, 2)).toBe(true)    // top edge
    expect(redAt(50, 97)).toBe(true)   // bottom edge
    expect(d[(50 * 100 + 50) * 4 + 3]).toBe(0)  // center untouched
  })
  it('drawBorder is a no-op for zero width', () => {
    const c = createSurface(40, 40)
    const ctx = getCtx(c)
    drawBorder(ctx, 40, 40, '#ffffff', 0)
    const d = ctx.getImageData(0, 0, 40, 40).data
    let painted = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++
    expect(painted).toBe(0)
  })
})
