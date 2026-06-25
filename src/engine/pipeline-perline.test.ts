// src/engine/pipeline-perline.test.ts
// Focused test: perLineFamilies modulo cycle so any line count is safe.

import { describe, it, expect } from 'vitest'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { render } from './pipeline'
import { defaultConfig } from './types'

GlobalFonts.registerFromPath('fonts/Anton.ttf', 'Anton')

describe('render: perLineFamilies modulo cycle', () => {
  it('does not throw when perLineFamilies has fewer entries than text lines', () => {
    // 5 text lines, only 2 perLineFamilies entries. Without modulo this would
    // return undefined for indices >= 2 and pass undefined as fontFamily to renderLine.
    const cfg = defaultConfig()
    cfg.text.content = 'A//B//C//D//E'
    cfg.text.sprayPaint.enabled = false
    const target = createCanvas(400, 500)
    // Should not throw
    expect(() =>
      render(cfg, target as unknown as HTMLCanvasElement, {
        fontFamily: 'Anton',
        perLineFamilies: ['Anton'],
      }),
    ).not.toThrow()
  })

  it('does not throw when perLineFamilies has more entries than text lines', () => {
    const cfg = defaultConfig()
    cfg.text.content = 'A//B'
    cfg.text.sprayPaint.enabled = false
    const target = createCanvas(400, 300)
    expect(() =>
      render(cfg, target as unknown as HTMLCanvasElement, {
        fontFamily: 'Anton',
        perLineFamilies: ['Anton', 'Anton', 'Anton', 'Anton'],
      }),
    ).not.toThrow()
  })
})
