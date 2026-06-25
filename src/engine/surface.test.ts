import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'

describe('canvas drawing baseline', () => {
  it('can draw and read back a pixel', () => {
    const c = createCanvas(10, 10)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 10, 10)
    const px = ctx.getImageData(5, 5, 1, 1).data
    expect([px[0], px[1], px[2], px[3]]).toEqual([255, 0, 0, 255])
  })
})
