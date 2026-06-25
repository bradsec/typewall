import { describe, it, expect } from 'vitest'
import { ImageData } from '@napi-rs/canvas'
import { minFilterAlpha, dilateAlpha, thresholdNoise, displaceEdges } from './imageops'
import { Rng } from './rng'

function img(w: number, h: number, fill: number) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = 255
    d[i * 4 + 3] = fill
  }
  return new ImageData(d, w, h) as unknown as { data: Uint8ClampedArray; width: number; height: number }
}

describe('imageops', () => {
  it('minFilterAlpha erodes a solid block (out-of-bounds treated as 0)', () => {
    const out = minFilterAlpha(img(10, 10, 255), 1)
    // corner pixel has OOB neighbors -> drops to 0
    expect(out.data[3]).toBe(0)
    // interior pixel fully surrounded by 255 stays 255
    const center = (5 * 10 + 5) * 4 + 3
    expect(out.data[center]).toBe(255)
    expect(out.data.length).toBe(10 * 10 * 4)
  })

  it('dilateAlpha grows a single bright pixel into its neighborhood', () => {
    const src = img(10, 10, 0)
    const center = (5 * 10 + 5) * 4 + 3
    src.data[center] = 255
    const out = dilateAlpha(src, 1)
    // the four-neighbour and diagonals around the center become 255
    expect(out.data[((5 * 10 + 4) * 4) + 3]).toBe(255)
    expect(out.data[((4 * 10 + 5) * 4) + 3]).toBe(255)
    expect(out.data[((4 * 10 + 4) * 4) + 3]).toBe(255)
    // a far pixel stays 0
    expect(out.data[((0 * 10 + 0) * 4) + 3]).toBe(0)
  })

  it('thresholdNoise is deterministic for a seed', () => {
    const a = thresholdNoise(8, 8, 200, new Rng(5))
    const b = thresholdNoise(8, 8, 200, new Rng(5))
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    expect(a.width).toBe(8)
    expect(a.height).toBe(8)
  })

  it('thresholdNoise keeps alpha 255 only where noise exceeds the threshold', () => {
    const out = thresholdNoise(16, 16, 200, new Rng(7))
    for (let i = 0; i < out.width * out.height; i++) {
      const al = out.data[i * 4 + 3]
      expect(al === 0 || al === 255).toBe(true)
    }
  })

  it('displaceEdges with zero maps returns an identical alpha channel', () => {
    const src = img(12, 12, 0)
    for (let i = 0; i < 12 * 12; i++) src.data[i * 4 + 3] = (i * 7) % 256
    const h = new Float32Array(12 * 12)
    const v = new Float32Array(12 * 12)
    const out = displaceEdges(src, h, v)
    for (let i = 0; i < 12 * 12; i++) {
      expect(out.data[i * 4 + 3]).toBe(src.data[i * 4 + 3])
    }
  })

  it('displaceEdges samples shifted source coordinates with clamping', () => {
    const src = img(8, 8, 0)
    // column 2 fully opaque
    for (let y = 0; y < 8; y++) src.data[(y * 8 + 2) * 4 + 3] = 255
    const h = new Float32Array(8 * 8)
    const v = new Float32Array(8 * 8)
    // shift sample +1 in x at column 1 so it reads column 2
    for (let y = 0; y < 8; y++) h[y * 8 + 1] = 1
    const out = displaceEdges(src, h, v)
    expect(out.data[(0 * 8 + 1) * 4 + 3]).toBe(255)
  })
})
