// Meme-mode caption layout: UPPERCASE top/bottom captions in an Impact-style
// font, drawn as either a white+black-outline overlay or white text on black
// letterbox bars. Pure engine module (OffscreenCanvas only).

import type { TextConfig } from './types'
import type { Rng } from './rng'
import { createSurface, getCtx, type Surface } from './surface'
import { splitLines } from './wrap'
import { calcLineLength } from './text-utils'
import { fitText } from './font-fit'
import { renderLine } from './text-render'

const CAPTION_MAX_H_PCT = 0.22
// Bar padding as a fraction of the caption's own height, so bars scale with the
// text rather than a fixed slab.
const BAR_PAD_RATIO = 0.3

function stackLines(surfaces: Surface[], spacing: number): Surface {
  if (surfaces.length === 0) return createSurface(1, 1)
  const w = Math.max(...surfaces.map((s) => s.width))
  const h = surfaces.reduce((sum, s) => sum + s.height, 0) + (surfaces.length - 1) * spacing
  const out = createSurface(w, Math.max(1, Math.round(h)))
  const ctx = getCtx(out)
  let y = 0
  for (const s of surfaces) {
    ctx.drawImage(s as unknown as CanvasImageSource, Math.round((w - s.width) / 2), Math.round(y))
    y += s.height + spacing
  }
  return out
}

function buildCaptionBlock(
  raw: string,
  canvasW: number,
  canvasH: number,
  availW: number,
  availH: number,
  text: TextConfig,
  fontFamily: string,
  outline: boolean,
  rng: Rng,
): Surface | null {
  const content = raw.trim().toUpperCase()
  if (!content) return null

  // Honor targetLines so Remix (meme mode) can re-balance the caption across a
  // different number of lines; undefined falls back to width-based wrapping.
  const lineLength = calcLineLength(canvasW, canvasH, content)
  const lines = splitLines(content, lineLength, text.targetLines)

  const measureCtx = getCtx(createSurface(1, 1))
  const { lines: sized } = fitText(measureCtx, {
    lines,
    fontFamily,
    baseFontPx: text.baseFontSize,
    availW,
    availH,
    lineSpacingPct: text.lineSpacingPct,
    blockText: false,
    canvasH,
  })

  const capText: TextConfig = {
    ...text,
    randomLineSlant: false,
    shadow: { ...text.shadow, enabled: false },
    outline: { ...text.outline, enabled: outline },
  }

  const spacing = text.lineSpacingPct * canvasH
  const surfaces = sized.map((line, i) =>
    renderLine({ line, fontFamily, text: capText, index: i, rng, slantAngleDeg: 0 }),
  )
  return stackLines(surfaces, spacing)
}

export function drawMeme(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  text: TextConfig,
  fontFamily: string,
  rng: Rng,
): void {
  const meme = text.meme
  if (!meme || !meme.enabled) return
  const bars = meme.style === 'bars'

  const padX = Math.trunc(canvasW * text.paddingPctWidth)
  const padY = Math.trunc(canvasH * text.paddingPctHeight)
  // captionScale (Remix-controlled, default 1) shrinks BOTH the width and height
  // budgets. Scaling width matters: a wide single word like "TYPEWALL" is
  // width-constrained, so without it the word stays full size and dominates the
  // image regardless of the height cap.
  const scale = meme.captionScale ?? 1
  const availW = (canvasW - 2 * padX) * scale
  const availH = canvasH * CAPTION_MAX_H_PCT * scale
  // Black bars hug the text: padding is proportional to the caption height, so
  // a smaller caption gets a smaller bar instead of a fixed oversized band.
  const barPadFor = (blockH: number) => Math.round(blockH * BAR_PAD_RATIO)

  const top = buildCaptionBlock(meme.topText, canvasW, canvasH, availW, availH, text, fontFamily, !bars, rng)
  const bottom = buildCaptionBlock(meme.bottomText, canvasW, canvasH, availW, availH, text, fontFamily, !bars, rng)

  if (top) {
    const blockH = top.height
    if (bars) {
      const barPad = barPadFor(blockH)
      const bandH = Math.round(blockH + 2 * barPad)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvasW, bandH)
      ctx.drawImage(top as unknown as CanvasImageSource, Math.round((canvasW - top.width) / 2), barPad)
    } else {
      ctx.drawImage(top as unknown as CanvasImageSource, Math.round((canvasW - top.width) / 2), padY)
    }
  }

  if (bottom) {
    const blockH = bottom.height
    if (bars) {
      const barPad = barPadFor(blockH)
      const bandH = Math.round(blockH + 2 * barPad)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, canvasH - bandH, canvasW, bandH)
      ctx.drawImage(bottom as unknown as CanvasImageSource, Math.round((canvasW - bottom.width) / 2), Math.round(canvasH - bandH + barPad))
    } else {
      ctx.drawImage(bottom as unknown as CanvasImageSource, Math.round((canvasW - bottom.width) / 2), Math.round(canvasH - padY - blockH))
    }
  }
}
