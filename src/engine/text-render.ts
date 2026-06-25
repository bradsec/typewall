// Per-line text rendering: shadow, outline, slant rotation, alpha-bbox crop.
// Ports the original Python CLI's text rendering.
// Uses OffscreenCanvas (browser/worker native); polyfilled in the Node test
// environment via vitest.setup.ts.

import type { LineSize } from './font-fit'
import type { TextConfig } from './types'
import type { Rng } from './rng'
import { createSurface, type Surface } from './surface'

export interface RenderLineOpts {
  line: LineSize
  fontFamily: string
  text: TextConfig
  index: number
  rng: Rng
  // Pre-computed slant angle in degrees. When supplied (e.g. by the pipeline,
  // which enforces the min-angle gap between consecutive lines) it overrides the
  // local parity/rng roll. When absent, the existing parity behavior is used.
  slantAngleDeg?: number
}

// Parse a CSS hex color string (#rgb, #rrggbb) into [r, g, b].
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Guard non-#rgb/#rrggbb input: NaN channels make canvas silently keep the
  // previous fill color, so fall back to white instead.
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [255, 255, 255]
  return [r, g, b]
}

function makeCanvas(w: number, h: number): Surface {
  return createSurface(w, h)
}

function getCtx(s: Surface): CanvasRenderingContext2D {
  const ctx = (s as HTMLCanvasElement).getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  return ctx as CanvasRenderingContext2D
}

// Feature-detect ctx.letterSpacing (absent on older @napi-rs/canvas in Node).
function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx
}

// Measure a string's drawn width including tracking.
// exported for tests
export function measureWidth(ctx: CanvasRenderingContext2D, str: string, lsPx: number): number {
  if (str.length === 0) return 0
  if (lsPx === 0) return ctx.measureText(str).width
  if (supportsLetterSpacing(ctx)) {
    ctx.letterSpacing = `${lsPx}px`
    const w = ctx.measureText(str).width
    return w
  }
  let w = 0
  for (const ch of str) w += ctx.measureText(ch).width + lsPx
  return w - lsPx // no trailing gap after last glyph
}

// Draw text honoring tracking. mode picks stroke vs fill.
function drawText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  mode: 'fill' | 'stroke',
  lsPx: number,
): void {
  if (lsPx === 0 || supportsLetterSpacing(ctx)) {
    ctx.letterSpacing = lsPx === 0 ? '0px' : `${lsPx}px`
    if (mode === 'stroke') ctx.strokeText(str, x, y)
    else ctx.fillText(str, x, y)
    return
  }
  let cx = x
  for (const ch of str) {
    if (mode === 'stroke') ctx.strokeText(ch, cx, y)
    else ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + lsPx
  }
}

// Crop a canvas to its non-transparent bounding box.
// Returns a new canvas containing only the visible region, or the original if
// no visible pixels exist.
function cropToAlphaBbox(src: Surface): Surface {
  const ctx = getCtx(src)
  const { width, height } = src
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]
      if (a > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (minX > maxX || minY > maxY) return src

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const out = makeCanvas(cropW, cropH)
  getCtx(out).drawImage(src as unknown as CanvasImageSource, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
  return out
}

export function renderLine(opts: RenderLineOpts): Surface {
  const { line, fontFamily, text, index, rng, slantAngleDeg } = opts
  const { fontPx } = line
  const shadow = text.shadow
  const outline = text.outline
  const lsPct = text.letterSpacingPct ?? 0
  const lsPx = Math.round(lsPct * fontPx)

  // Padding for slant rotation (10% of a nominal canvas width derived from fontPx).
  // The reference uses 10% of text_canvas_width; we use fontPx * 10 as the proxy
  // canvas width so the padding proportion is identical.
  const nominalW = fontPx * 10
  const rotPad = text.randomLineSlant ? Math.round(nominalW * 0.1) : 0

  // Size a scratch canvas to measure text width.
  const measure = makeCanvas(1, 1)
  const mctx = getCtx(measure)
  mctx.font = `${fontPx}px ${fontFamily}`
  const textW = measureWidth(mctx, line.text, lsPx)

  // Layer dimensions: text region plus rotation padding on all sides.
  const layerW = Math.ceil(textW) + rotPad * 2 + fontPx * 2  // extra fontPx*2 for outline/shadow bleed
  const layerH = Math.ceil(fontPx * 1.5) + rotPad * 2 + fontPx // headroom for descenders + shadow

  const canvas = makeCanvas(layerW, layerH)
  const ctx = getCtx(canvas)

  ctx.font = `${fontPx}px ${fontFamily}`

  // Center text within layer.
  const x = (layerW - textW) / 2
  // Vertically center: use fontPx as approximate cap height anchor.
  const y = layerH / 2 + fontPx * 0.35

  // Shadow (drawn first, behind main text).
  if (shadow.enabled) {
    // Scale shadow offset: offsetX/Y are fractions of canvas width/height.
    // Effective pixels = offsetX * nominalW * (fontPx / (nominalW/10)) = offsetX * fontPx * 10
    const sx = Math.round(shadow.offsetX * fontPx * 10)
    const sy = Math.round(shadow.offsetY * fontPx * 10)
    const [r, g, b] = hexToRgb(shadow.color)
    ctx.fillStyle = `rgba(${r},${g},${b},${shadow.opacity / 255})`
    drawText(ctx, line.text, x + sx, y + sy, 'fill', lsPx)
  }

  // Main text: outline then fill.
  if (outline.enabled) {
    const strokeWidth = Math.max(1, Math.round(fontPx * outline.ratio))
    const [or, og, ob] = hexToRgb(outline.color)
    ctx.lineWidth = strokeWidth
    ctx.strokeStyle = `rgb(${or},${og},${ob})`
    ctx.lineJoin = 'round'
    drawText(ctx, line.text, x, y, 'stroke', lsPx)
  }

  const [tr, tg, tb] = hexToRgb(text.color)
  ctx.fillStyle = `rgba(${tr},${tg},${tb},${text.opacity / 255})`
  drawText(ctx, line.text, x, y, 'fill', lsPx)

  // Slant rotation (reference line 272-289): even index negative, odd positive.
  // Note: reference uses Python random.uniform with no Rng abstraction; brief specifies
  // Rng.range(-3,0) / Rng.range(0,3). We follow the brief here.
  let rotated: Surface = canvas
  if (text.randomLineSlant) {
    const deg = slantAngleDeg ?? (index % 2 === 0 ? rng.range(-3, 0) : rng.range(0, 3))
    const rad = (deg * Math.PI) / 180

    // Expand bounds to avoid clipping after rotation.
    // Use the diagonal length as the safe canvas size.
    const diag = Math.ceil(Math.sqrt(layerW * layerW + layerH * layerH))
    const rot = makeCanvas(diag, diag)
    const rctx = getCtx(rot)
    rctx.translate(diag / 2, diag / 2)
    rctx.rotate(rad)
    rctx.drawImage(canvas as unknown as CanvasImageSource, -layerW / 2, -layerH / 2)
    rotated = rot
  }

  return cropToAlphaBbox(rotated)
}
