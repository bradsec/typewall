import { imageDataRGBA } from 'stackblur-canvas'
import type { BackgroundConfig, BackgroundFit, WatermarkPosition } from './types'
import { createSurface, getCtx, type Surface } from './surface'

// Compute the destination rect for drawing a source image onto a w*h canvas
// under the given fit mode. cover/contain preserve aspect (centered); fill
// stretches to the full canvas.
function fitRect(
  srcW: number, srcH: number, dstW: number, dstH: number, fit: BackgroundFit,
): { x: number; y: number; w: number; h: number } {
  if (fit === 'fill' || srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: dstW, h: dstH }
  const srcAspect = srcW / srcH
  const dstAspect = dstW / dstH
  const cover = fit === 'cover'
  let w: number
  let h: number
  if ((srcAspect > dstAspect) === cover) {
    h = dstH
    w = dstH * srcAspect
  } else {
    w = dstW
    h = dstW / srcAspect
  }
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

/**
 * Fills the canvas with the background: solid color or transparent.
 * If cfg.image.enabled and bgImage is supplied, composites the image at the
 * given opacity with Gaussian blur applied via stackblur-canvas.
 *
 * Ports the original Python CLI's background fill.
 */
export function fillBackground(
  ctx: CanvasRenderingContext2D,
  cfg: BackgroundConfig,
  w: number,
  h: number,
  bgImage?: ImageBitmap | Surface,
): void {
  if (cfg.transparent) {
    ctx.clearRect(0, 0, w, h)
    return
  }

  ctx.fillStyle = cfg.color
  ctx.fillRect(0, 0, w, h)

  if (cfg.image.enabled && bgImage != null) {
    const tmp = createSurface(w, h)
    const tx = getCtx(tmp)
    tx.globalAlpha = cfg.image.opacity / 255
    const dst = fitRect(bgImage.width, bgImage.height, w, h, cfg.image.fit ?? 'cover')
    tx.drawImage(bgImage as CanvasImageSource, dst.x, dst.y, dst.w, dst.h)
    tx.globalAlpha = 1

    if (cfg.image.blurFactor > 0) {
      const imgData = tx.getImageData(0, 0, w, h)
      const blurRadius = computeBlurRadius(w, h, cfg.image.blurFactor)
      if (blurRadius >= 1) {
        const blurred = imageDataRGBA(imgData as ImageData, 0, 0, w, h, Math.round(blurRadius))
        tx.putImageData(blurred as ImageData, 0, 0)
      }
    }

    ctx.drawImage(tmp as unknown as CanvasImageSource, 0, 0)
  }
}

/**
 * Mirrors the Python image_blur scale: blur_factor * sqrt(area) / (100 * sqrt(100)).
 */
function computeBlurRadius(w: number, h: number, blurFactor: number): number {
  return blurFactor * Math.sqrt(w * h) / (100 * Math.sqrt(100))
}

/**
 * Composites an overlay image onto ctx at the given opacity (0-255).
 *
 * Ports the original Python CLI's overlay compositing.
 */
export function applyOverlay(
  ctx: CanvasRenderingContext2D,
  img: Surface,
  opacity: number,
  canvasW: number,
  canvasH: number,
  fit: BackgroundFit = 'cover',
): void {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = opacity / 255
  const dst = fitRect(img.width, img.height, canvasW, canvasH, fit)
  ctx.drawImage(img as unknown as CanvasImageSource, dst.x, dst.y, dst.w, dst.h)
  ctx.globalAlpha = prev
}

/**
 * Applies a mask to the text block using reference-faithful semantics: pixels
 * where the mask alpha is OPAQUE (255) are cut to transparent; pixels where
 * the mask alpha is TRANSPARENT (0) are kept unchanged.
 *
 * Per-pixel: outAlpha = textAlpha * (1 - maskAlpha / 255)
 *
 * This matches the original Python CLI:
 *   text_block.paste(Image.new("RGBA", text_block.size), mask=text_mask_layer)
 * PIL paste with a fully-transparent source erases wherever the mask is opaque.
 *
 * The mask parameter accepts any CanvasImageSource (Surface or ImageBitmap).
 * ImageBitmap (from browser asset loading) has no getContext method, so the
 * mask is drawn onto a scratch Surface first to obtain pixel data.
 *
 * Returns a new Surface.
 */
export function applyTextMask(
  textBlock: Surface,
  mask: CanvasImageSource & { width: number; height: number },
  fit: BackgroundFit = 'cover',
  opacity = 255,
): Surface {
  const w = textBlock.width
  const h = textBlock.height

  const bx = getCtx(textBlock)
  const block = bx.getImageData(0, 0, w, h)

  // Draw the mask (any CanvasImageSource, including ImageBitmap) onto a scratch
  // Surface so we can read pixel data via getImageData. Fit preserves aspect.
  const scratch = createSurface(w, h)
  const sx = getCtx(scratch)
  const dst = fitRect(mask.width, mask.height, w, h, fit)
  sx.drawImage(mask, dst.x, dst.y, dst.w, dst.h)
  const maskData = sx.getImageData(0, 0, w, h)

  // Brightness-based mask: bright mask pixels cut text, dark pixels keep it.
  // Cut strength = luminance * maskAlpha (so transparent/letterbox areas keep
  // text) * opacity. outAlpha = textAlpha * (1 - cut).
  const strength = opacity / 255
  for (let i = 0; i < w * h; i++) {
    const r = maskData.data[i * 4]
    const g = maskData.data[i * 4 + 1]
    const b = maskData.data[i * 4 + 2]
    const maskAlpha = maskData.data[i * 4 + 3] / 255
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const cut = luminance * maskAlpha * strength
    block.data[i * 4 + 3] = Math.round(block.data[i * 4 + 3] * (1 - cut))
  }

  const out = createSurface(w, h)
  getCtx(out).putImageData(block, 0, 0)
  return out
}

/**
 * Draws a solid border inset along the canvas edges (a page frame). The stroke
 * is offset by half its width so the full thickness stays inside the canvas.
 * No-op when width <= 0.
 */
export function drawBorder(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  color: string,
  width: number,
): void {
  if (width <= 0) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.strokeRect(width / 2, width / 2, canvasW - width, canvasH - width)
  ctx.restore()
}

/**
 * Draws a logo onto ctx at one of 8 position presets with scale, padding,
 * and opacity.
 *
 * padding = min(canvasW, canvasH) * paddingPct
 * logo drawn at min(canvasW, canvasH) * scaleFactor preserving aspect ratio.
 *
 * Ports the original Python CLI's text-mask routine.
 */
export function placeWatermark(
  ctx: CanvasRenderingContext2D,
  logo: Surface,
  pos: WatermarkPosition,
  scaleFactor: number,
  paddingPct: number,
  opacity: number,
  canvasW: number,
  canvasH: number,
): void {
  const minDim = Math.min(canvasW, canvasH)
  const padding = Math.floor(paddingPct * minDim)

  let logoW: number
  let logoH: number
  if (logo.width >= logo.height) {
    logoW = Math.max(1, Math.floor(scaleFactor * minDim))
    logoH = Math.max(1, Math.floor(logoW * logo.height / logo.width))
  } else {
    logoH = Math.max(1, Math.floor(scaleFactor * minDim))
    logoW = Math.max(1, Math.floor(logoH * logo.width / logo.height))
  }

  let x: number
  let y: number
  switch (pos) {
    case 'bottom-left':
      x = padding
      y = canvasH - logoH - padding
      break
    case 'bottom-right':
      x = canvasW - logoW - padding
      y = canvasH - logoH - padding
      break
    case 'top-left':
      x = padding
      y = padding
      break
    case 'top-right':
      x = canvasW - logoW - padding
      y = padding
      break
    case 'top-middle':
      x = Math.floor((canvasW - logoW) / 2)
      y = padding
      break
    case 'bottom-middle':
      x = Math.floor((canvasW - logoW) / 2)
      y = canvasH - logoH - padding
      break
    case 'left-middle':
      x = padding
      y = Math.floor((canvasH - logoH) / 2)
      break
    case 'right-middle':
      x = canvasW - logoW - padding
      y = Math.floor((canvasH - logoH) / 2)
      break
    default:
      x = Math.floor((canvasW - logoW) / 2)
      y = canvasH - logoH - padding
  }

  const prev = ctx.globalAlpha
  ctx.globalAlpha = opacity / 255
  ctx.drawImage(logo as unknown as CanvasImageSource, x, y, logoW, logoH)
  ctx.globalAlpha = prev
}
