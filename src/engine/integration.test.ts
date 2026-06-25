// End-to-end headless render test. Exercises the full pipeline (background,
// per-line text layers, spray paint) in a single call and checks that the
// output is a non-trivial PNG buffer.
//
// Uses the @napi-rs/canvas polyfill registered in vitest.setup.ts (Anton
// font + OffscreenCanvas shim) so no browser is required.

import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { render } from './pipeline'
import { defaultConfig } from './types'

describe('end-to-end render', () => {
  it('renders text + spray paint without throwing and produces a non-trivial PNG buffer', () => {
    const cfg = defaultConfig()
    cfg.text.content = 'TRAIN//HARD'
    cfg.text.sprayPaint.enabled = true
    cfg.seed = 1

    const c = createCanvas(cfg.sizeFormat.width, cfg.sizeFormat.height)
    render(cfg, c as any, { fontFamily: 'Anton' })

    const buf = c.toBuffer('image/png')
    expect(buf.length).toBeGreaterThan(50000)
  })
})
