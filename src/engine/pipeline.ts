// Pipeline orchestrator: assembles the full image from the prior engine modules.
//
// Ports the original Python CLI's generate_image_task. The
// render order is: background -> overlay -> per-line text layers -> composite ->
// spray -> text mask -> center onto canvas -> watermark.
//
// This module is browser/worker-safe: it draws onto Surface (OffscreenCanvas or
// HTMLCanvasElement) and contains no native-canvas (napi) references.

import type { RenderConfig, WatermarkConfig } from './types'
import { Rng } from './rng'
import { createSurface, getCtx, type Surface } from './surface'
import { splitLines } from './wrap'
import { calcLineLength } from './text-utils'
import { fitText } from './font-fit'
import { renderLine } from './text-render'
import { compositeLines } from './compositor'
import { applySpray } from './spray-paint'
import { fillBackground, applyOverlay, applyTextMask, placeWatermark, drawBorder } from './layers'
import { drawMeme } from './meme-layout'

// Resolution-reference font size: spray scale_factor = fittedMaxFontPx / 80,
// matching reference SCALE_FACTOR derivation (FONT_SIZE_REFERENCE).
const FONT_SIZE_REFERENCE = 80
const SCALE_FACTOR_MIN = 0.4
const SCALE_FACTOR_MAX = 2.5

// Minimum angular gap between consecutive slanted lines (reference
// generator.py:189 min_angle_difference).
const MIN_ANGLE_DIFFERENCE = 1.0
const SLANT_MAX_ATTEMPTS = 10

export interface ResolvedAssets {
  fontFamily: string
  perLineFamilies?: string[]
  bgImage?: Surface | ImageBitmap
  overlayImage?: Surface | ImageBitmap
  maskImage?: Surface | ImageBitmap
  watermarkImage?: Surface | ImageBitmap
}

/**
 * Computes one slant angle per line, enforcing the reference min-angle gap.
 *
 * Parity matches reference generator.py:277-280 (even index -> [-3, 0), odd ->
 * [0, 3)). After each roll, up to SLANT_MAX_ATTEMPTS - 1 re-rolls run until the
 * angle differs from the previous line's by at least MIN_ANGLE_DIFFERENCE
 * (generator.py:282-285). All randomness flows through the supplied Rng.
 */
export function computeSlantAngles(lineCount: number, seed: number): number[] {
  const rng = new Rng(seed)
  const angles: number[] = []
  let previous = 0
  for (let i = 0; i < lineCount; i++) {
    let angle = 0
    for (let attempt = 0; attempt < SLANT_MAX_ATTEMPTS; attempt++) {
      angle = i % 2 === 0 ? rng.range(-3, 0) : rng.range(0, 3)
      if (Math.abs(angle - previous) >= MIN_ANGLE_DIFFERENCE) break
    }
    angles.push(angle)
    previous = angle
  }
  return angles
}

export function render(config: RenderConfig, target: Surface, assets: ResolvedAssets): void {
  const { sizeFormat, text, background, overlay, watermark, border } = config
  const canvasW = sizeFormat.width
  const canvasH = sizeFormat.height
  const transparent = background.transparent

  const rng = new Rng(config.seed)
  const ctx = getCtx(target)

  // 1. Background (solid color or transparent; bg image with opacity + blur).
  fillBackground(ctx, background, canvasW, canvasH, assets.bgImage)

  // 2. Overlay image, skipped on transparent formats (reference:776, 802-805).
  if (!transparent && overlay.image.enabled && assets.overlayImage) {
    applyOverlay(ctx, assets.overlayImage as Surface, overlay.image.opacity, canvasW, canvasH, overlay.image.fit ?? 'cover')
  }

  // 3-7. Text: meme captions, or the standard centered per-line block. When
  // there is no text (empty content), the background/overlay are still drawn
  // above so the chosen format and background show on an empty canvas.
  if (text.meme?.enabled) {
    drawMeme(ctx, canvasW, canvasH, text, assets.fontFamily, rng)
  } else if (text.content.trim().length > 0) {
    // 3. Per-line text layers.
    const padX = Math.trunc(canvasW * text.paddingPctWidth)
    const padY = Math.trunc(canvasH * text.paddingPctHeight)
    const availW = canvasW - 2 * padX
    const availH = canvasH - 2 * padY

    const lineLength = calcLineLength(canvasW, canvasH, text.content)
    const rawLines = splitLines(text.content, lineLength, text.targetLines)

    // fitText needs a measuring context; use a scratch surface.
    const measureCtx = getCtx(createSurface(1, 1))
    const { lines: sizedLines, maxFontPx } = fitText(measureCtx, {
      lines: rawLines,
      fontFamily: assets.fontFamily,
      perLineFonts: assets.perLineFamilies,
      baseFontPx: text.baseFontSize,
      availW,
      availH,
      lineSpacingPct: text.lineSpacingPct,
      blockText: text.blockText,
      canvasH,
      letterSpacingPct: text.letterSpacingPct,
    })

    const slantAngles = text.randomLineSlant
      ? computeSlantAngles(sizedLines.length, config.seed)
      : []

    const lineSurfaces = sizedLines.map((line, i) =>
      renderLine({
        line,
        fontFamily: assets.perLineFamilies && assets.perLineFamilies.length > 0
          ? assets.perLineFamilies[i % assets.perLineFamilies.length]
          : assets.fontFamily,
        text,
        index: i,
        rng,
        slantAngleDeg: text.randomLineSlant ? slantAngles[i] : undefined,
      }),
    )

    // 4. Composite the line surfaces into a single text block.
    let textBlock = compositeLines({
      lineSurfaces,
      canvasW,
      canvasH,
      padX,
      padY,
      lineSpacingPct: text.lineSpacingPct,
      alignment: text.alignment,
      blockText: text.blockText,
    })

    // 5. Spray paint, scaled by fitted font size (reference scale_factor).
    if (text.sprayPaint.enabled) {
      const scaleFactor = Math.min(
        SCALE_FACTOR_MAX,
        Math.max(SCALE_FACTOR_MIN, maxFontPx / FONT_SIZE_REFERENCE),
      )
      textBlock = applySpray(textBlock, text.sprayPaint, text.color, rng, scaleFactor)
    }

    // 6. Text mask, skipped on transparent formats (reference:816-819).
    if (!transparent && overlay.textMask.enabled && assets.maskImage) {
      textBlock = applyTextMask(textBlock, assets.maskImage as CanvasImageSource & { width: number; height: number }, overlay.textMask.fit ?? 'cover', overlay.textMask.opacity ?? 255)
    }

    // 7. Center the text block on the canvas (reference:821-825).
    const pasteX = Math.trunc((canvasW - textBlock.width) / 2)
    const pasteY = Math.trunc((canvasH - textBlock.height) / 2)
    ctx.drawImage(textBlock as unknown as CanvasImageSource, pasteX, pasteY)
  }

  // 8. Watermark, applying per-format overrides first (reference:778-782).
  if (watermark.enabled && assets.watermarkImage) {
    const wm = resolveWatermark(watermark, sizeFormat.name)
    placeWatermark(
      ctx,
      assets.watermarkImage as Surface,
      wm.position,
      wm.scaleFactor,
      wm.paddingPct,
      wm.opacity,
      canvasW,
      canvasH,
    )
  }

  // 9. Page border (frame), drawn last so it sits above all content. Suppressed
  // in meme mode, where the frame conflicts with the meme layout.
  if (border?.enabled && !text.meme?.enabled) {
    drawBorder(ctx, canvasW, canvasH, border.color, border.width)
  }
}

function resolveWatermark(wm: WatermarkConfig, formatName: string): WatermarkConfig {
  const override = wm.formatOverrides[formatName]
  if (!override) return wm
  return { ...wm, ...override }
}
